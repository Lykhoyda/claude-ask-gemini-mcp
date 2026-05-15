import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

// codex-pair feedback (run-B-v2 task-2 MED): the previous ipMap grew unbounded
// for every distinct IP. Run a periodic sweep that drops entries whose entire
// request window has expired. Conservative interval; entries are also pruned
// inline on every request that touches the same IP.
const CLEANUP_INTERVAL_MS = WINDOW_MS * 10;

// codex-pair feedback (run-B-v2 task-2 HIGH): the fixed-window counter reset
// allowed 10+10 = 20 requests in ~2 seconds at the boundary. Replaced with a
// sliding window via per-IP timestamp deque — we keep only timestamps within
// the last WINDOW_MS, then check count >= MAX. No boundary bypass exists
// because the window slides continuously.
const ipTimestamps = new Map<string, number[]>();

function pruneAndCount(ip: string, now: number): number {
  const cutoff = now - WINDOW_MS;
  const timestamps = ipTimestamps.get(ip);
  if (!timestamps) return 0;
  // Drop timestamps older than the window. Since we push monotonically, a
  // linear scan from the front finds the cutoff index in O(k) where k = drop
  // count; bounded by MAX_REQUESTS in steady state.
  let dropIdx = 0;
  while (dropIdx < timestamps.length && timestamps[dropIdx] <= cutoff) {
    dropIdx += 1;
  }
  if (dropIdx > 0) timestamps.splice(0, dropIdx);
  if (timestamps.length === 0) {
    ipTimestamps.delete(ip);
    return 0;
  }
  return timestamps.length;
}

let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanupScheduled(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const ip of [...ipTimestamps.keys()]) {
      pruneAndCount(ip, now);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't keep the process alive solely for cleanup
  cleanupTimer.unref?.();
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  ensureCleanupScheduled();
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const count = pruneAndCount(ip, now);

  if (count >= MAX_REQUESTS) {
    const timestamps = ipTimestamps.get(ip) ?? [];
    const oldest = timestamps[0] ?? now;
    const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const timestamps = ipTimestamps.get(ip) ?? [];
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
  next();
}

// Test helper: clear rate-limit state between tests so suites don't leak.
export function _resetRateLimitForTests(): void {
  ipTimestamps.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
