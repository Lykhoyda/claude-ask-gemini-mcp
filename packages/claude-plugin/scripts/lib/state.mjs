// Durable hook state: cache, log, pause sentinel, inflight lock (extracted
// from codex-pair-watch.mjs per ADR-088, originally ADR-079/082/085/086/087).
//
// All filesystem state lives under the marker directory:
//   .codex-pair-cache/         — content-hash response cache (ADR-082)
//   .codex-pair-log.jsonl      — durable verdicts log (ADR-079/086)
//   .codex-pair-state/paused   — pause sentinel (ADR-085)
//   .codex-pair-state/inflight — per-file lock (ADR-087)
//
// Atomic-write semantics per ADR-086: cache writes use tmp+rename; log
// entries are clamped under PIPE_BUF for atomic appendFile O_APPEND.

import { appendFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

export const LOG_FILENAME = ".codex-pair-log.jsonl";
export const MAX_LOG_BYTES = Number(process.env.CODEX_PAIR_MAX_LOG_BYTES ?? 2_000_000);
export const MAX_LOG_ENTRIES = 1000;
export const MAX_LOG_REASON_BYTES = 3500;

export const CACHE_DIR = ".codex-pair-cache";
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 50;

export const PAUSE_STATE_DIR = ".codex-pair-state";
export const PAUSE_SENTINEL_FILE = "paused";

export const INFLIGHT_DIR = "inflight";
export const INFLIGHT_TTL_MIN_MS = 600_000;

// ── Pause sentinel (ADR-085) ─────────────────────────────────────────────
export function isPaused(markerDir) {
  try {
    statSync(join(markerDir, PAUSE_STATE_DIR, PAUSE_SENTINEL_FILE));
    return true;
  } catch {
    return false;
  }
}

// ── Inflight lock (ADR-087) ──────────────────────────────────────────────
export function inflightLockPath(markerDir, filePath) {
  const hash = createHash("sha256").update(filePath).digest("hex").slice(0, 16);
  return join(markerDir, PAUSE_STATE_DIR, INFLIGHT_DIR, hash);
}

export function tryAcquireInflightLock(markerDir, filePath, ttlMs) {
  const lockPath = inflightLockPath(markerDir, filePath);
  try {
    mkdirSync(dirname(lockPath), { recursive: true });
  } catch {
    // mkdir failures fall through — writeFileSync below will report the real error
  }
  try {
    writeFileSync(lockPath, String(process.pid), { flag: "wx" });
    return { acquired: true, lockPath };
  } catch (err) {
    if (!err || err.code !== "EEXIST") {
      return { acquired: false, lockPath, reason: "error" };
    }
  }
  try {
    const stats = statSync(lockPath);
    if (Date.now() - stats.mtimeMs <= ttlMs) {
      return { acquired: false, lockPath, reason: "in-flight" };
    }
  } catch {
    // Lock vanished between EEXIST and stat — retry the create
  }
  try {
    unlinkSync(lockPath);
  } catch {
    // someone else already cleaned up — fine, fall through to retry
  }
  try {
    writeFileSync(lockPath, String(process.pid), { flag: "wx" });
    return { acquired: true, lockPath, recoveredStale: true };
  } catch {
    return { acquired: false, lockPath, reason: "race" };
  }
}

export function releaseInflightLock(lockPath) {
  if (!lockPath) return;
  try {
    unlinkSync(lockPath);
  } catch {
    // already gone — fine
  }
}

// ── Content-hash cache (ADR-082, atomic per ADR-086) ─────────────────────
export function computeCacheKey({ model, prompt, fileContent, surfaceThreshold }) {
  const h = createHash("sha256");
  h.update(model);
  h.update("\0");
  h.update(prompt);
  h.update("\0");
  h.update(fileContent);
  h.update("\0");
  h.update(surfaceThreshold);
  return h.digest("hex");
}

export function cachePathFor(markerDir, cacheKey) {
  return join(markerDir, CACHE_DIR, cacheKey.slice(0, 2), `${cacheKey.slice(2)}.json`);
}

export async function getCachedConcerns(markerDir, cacheKey) {
  const cachePath = cachePathFor(markerDir, cacheKey);
  try {
    const stats = await stat(cachePath);
    if (Date.now() - stats.mtimeMs > CACHE_TTL_MS) return null;
    const raw = await readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.high) ||
      !Array.isArray(parsed.med) ||
      !Array.isArray(parsed.low)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedConcerns(markerDir, cacheKey, value) {
  const cachePath = cachePathFor(markerDir, cacheKey);
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    const tmpPath = `${cachePath}.tmp.${process.pid}`;
    await writeFile(tmpPath, JSON.stringify(value));
    await rename(tmpPath, cachePath);
  } catch {
    // intentional no-op — cache write failures must never break Claude's flow
  }
  await evictCacheOldest(markerDir);
}

export async function evictCacheOldest(markerDir) {
  try {
    const cacheRoot = join(markerDir, CACHE_DIR);
    const entries = [];
    const prefixes = await readdir(cacheRoot);
    for (const prefix of prefixes) {
      let files;
      try {
        files = await readdir(join(cacheRoot, prefix));
      } catch {
        continue;
      }
      for (const file of files) {
        const full = join(cacheRoot, prefix, file);
        try {
          const s = await stat(full);
          entries.push({ path: full, mtimeMs: s.mtimeMs });
        } catch {
          // skip unreadable entries
        }
      }
    }
    if (entries.length <= CACHE_MAX_ENTRIES) return;
    entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const drop = entries.slice(0, entries.length - CACHE_MAX_ENTRIES);
    for (const e of drop) {
      try {
        await unlink(e.path);
      } catch {
        // skip if already deleted by a concurrent run
      }
    }
  } catch {
    // intentional no-op — eviction is best-effort
  }
}

// ── Log (ADR-079 rotation + ADR-086 clamp) ────────────────────────────────
export async function rotateLogIfNeeded(logPath) {
  try {
    const stats = await stat(logPath);
    if (stats.size <= MAX_LOG_BYTES) return;
    const content = await readFile(logPath, "utf8");
    const lines = content.split("\n").filter((l) => l.length > 0);
    if (lines.length <= MAX_LOG_ENTRIES) return;
    const tail = lines.slice(-MAX_LOG_ENTRIES);
    const tmpPath = `${logPath}.tmp`;
    await writeFile(tmpPath, `${tail.join("\n")}\n`);
    await rename(tmpPath, logPath);
  } catch {
    // intentional no-op — rotation is best-effort
  }
}

export function clampReason(reason) {
  if (typeof reason !== "string" || reason.length <= MAX_LOG_REASON_BYTES) {
    return reason;
  }
  const dropped = reason.length - MAX_LOG_REASON_BYTES;
  return `${reason.slice(0, MAX_LOG_REASON_BYTES)}…(${dropped}b truncated)`;
}

export async function appendLog(markerDir, entry) {
  const logPath = join(markerDir, LOG_FILENAME);
  const safe = entry?.reason !== undefined ? { ...entry, reason: clampReason(entry.reason) } : entry;
  try {
    await appendFile(logPath, `${JSON.stringify(safe)}\n`);
  } catch {
    // logging failures must never break Claude's flow
    return;
  }
  await rotateLogIfNeeded(logPath);
}
