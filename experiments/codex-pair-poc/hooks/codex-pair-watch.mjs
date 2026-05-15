#!/usr/bin/env node
// codex-pair-watch — PostToolUse hook that runs Codex as a background validator
// after each file edit. Designed for high-precision, low-recall: Codex stays
// silent on most edits (returning PASS) and only emits feedback when it has a
// load-bearing concern. Non-PASS responses go to stderr (Claude sees on next
// turn) and every call is logged to .codex-pair-log.jsonl for benchmark
// analysis afterward.
//
// See ../README.md for benchmark methodology (Claude alone vs Claude + Codex).

import { spawn } from "node:child_process";
import { readFile, appendFile, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Hard cap on Codex call duration. Default 60s — gpt-5.5 on a few hundred lines
// of code finishes in 10–40s typically; the cap exists so a stuck Codex doesn't
// strand Claude indefinitely. Override via env for benchmark experiments.
const CODEX_TIMEOUT_MS = Number(process.env.CODEX_PAIR_TIMEOUT_MS ?? 60_000);

// Tool names we care about. Edit/Write/MultiEdit are the file-mutating tools;
// everything else (Read, Bash, Glob, etc.) we silently pass through.
const WATCHED_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

// Log file lives in the user's cwd at hook-invocation time, which is normally
// the project root. Benchmark scripts read this to count fires + extract
// codex's verdicts.
const LOG_PATH = resolve(process.cwd(), ".codex-pair-log.jsonl");

// The validator prompt (v2). Replaces the v1 "PASS unless load-bearing" gate
// with a 3-grade confidence ladder (HIGH/MED/LOW). Decouples "what codex sees"
// from "what threshold the hook surfaces" — the hook (not the prompt) decides
// which labels reach Claude. See runs/findings.md (run 1) for why the v1 prompt
// produced 0% recall on real defects.
//
// Project context (if a .codex-pair-context.md file exists in cwd) is prepended
// so codex knows the deployment shape (concurrent server, etc.) — single-file
// view was identified as a root cause of v1's race-condition miss.
function buildPrompt({ filePath, fileContent, toolName, projectContext }) {
  const contextBlock = projectContext
    ? `## Project context\n\n${projectContext.trim()}\n\n`
    : "";
  return `You are a senior software engineer reviewing a file another AI agent (Claude) just edited. Find every concern that's worth a human's attention. Don't try to be polite or "balanced" — your job is to surface what's actually wrong or risky.

${contextBlock}## Output format — strict

Respond with exactly one of these two shapes:

(a) If you have NO concerns at any level, reply with EXACTLY the word \`NONE\` and nothing else.

(b) If you have concerns, list them with a confidence label per concern:

\`\`\`
[HIGH] <one-line summary>
<file:line>: <one or two sentences explaining the issue>
<one-sentence suggested fix>

[MED] <one-line summary>
<file:line>: <one or two sentences explaining the issue>
<one-sentence suggested fix>

[LOW] <one-line summary>
<file:line>: <one or two sentences explaining the issue>
<one-sentence suggested fix>
\`\`\`

## How to grade

- **HIGH** — would definitely cause incorrect behavior, security issue, or violates a stated project requirement. Examples: race condition in a concurrent server, untrusted JSON parsed without validation, SQL injection, type system bypassed with \`as any\`, missing await on an async operation.
- **MED** — likely to cause problems under realistic conditions, even if not 100% certain. Examples: non-atomic file write that could corrupt on partial failure, missing error handling for IO/network operations, TOCTOU races, edge-case logic bugs that tests don't cover.
- **LOW** — code-quality concerns worth knowing about but not blocking. Examples: minor naming issues, style inconsistencies, missing JSDoc on exported APIs, opportunities for clearer error messages.

## Rules

- One concern per [LABEL] block. Don't bundle multiple issues under one label.
- Cite specific \`file:line\` references. Do not hand-wave.
- Don't include preamble or "summary" — just the labeled list (or \`NONE\`).
- Don't suppress real concerns because "the test suite probably catches it." If you'd flag it in a code review, flag it here.
- Don't manufacture concerns to fill labels. If there's only HIGH, only emit HIGH.

## The file

The agent (${toolName}) just modified \`${filePath}\`. File content:

\`\`\`
${fileContent}
\`\`\``;
}

// Read the optional project-context file from cwd. Returns null if not present.
// The file is plain markdown — typical content: deployment shape, concurrency
// model, stated requirements, anything that a reviewer of a single file can't
// derive from that file alone.
async function readProjectContext() {
  const contextPath = resolve(process.cwd(), ".codex-pair-context.md");
  try {
    await access(contextPath);
    return await readFile(contextPath, "utf8");
  } catch {
    return null;
  }
}

// Parse codex's labeled output into structured concerns. Lenient about exact
// formatting because LLM output is not perfectly deterministic.
function parseConcerns(message) {
  const trimmed = message.trim();
  if (trimmed.toUpperCase() === "NONE" || trimmed.startsWith("NONE\n")) {
    return { high: [], med: [], low: [] };
  }
  // Split on [LABEL] markers, preserving the marker with each chunk.
  const parts = trimmed.split(/(?=\[(?:HIGH|MED|LOW)\])/);
  const concerns = { high: [], med: [], low: [] };
  for (const part of parts) {
    const labelMatch = part.match(/^\[(HIGH|MED|LOW)\]/);
    if (!labelMatch) continue;
    const body = part.slice(labelMatch[0].length).trim();
    if (body.length === 0) continue;
    const label = labelMatch[1].toLowerCase();
    if (label === "high") concerns.high.push(body);
    else if (label === "med") concerns.med.push(body);
    else if (label === "low") concerns.low.push(body);
  }
  return concerns;
}

// Spawn codex with a strict argv shape. Mirrors the args used by ask-codex-mcp
// (--skip-git-repo-check, --ephemeral, --ignore-user-config, --ignore-rules,
// --sandbox workspace-write, --json) for deterministic behavior regardless of
// the user's local codex config.
function runCodex(prompt) {
  return new Promise((resolveCall) => {
    const args = [
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--sandbox",
      "workspace-write",
      "--json",
      "-m",
      "gpt-5.5",
      prompt,
    ];
    const child = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGTERM");
      } catch {}
      resolveCall({ ok: false, reason: "timeout", durationMs: CODEX_TIMEOUT_MS });
    }, CODEX_TIMEOUT_MS);

    const startedAt = Date.now();
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveCall({ ok: false, reason: `spawn-error: ${err.message}`, durationMs: Date.now() - startedAt });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolveCall({ ok: false, reason: `exit-${code}`, stderr: stderr.slice(0, 500), durationMs: Date.now() - startedAt });
        return;
      }
      // Parse codex's JSONL for the final agent_message
      let message = "";
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === "item.completed" && parsed.item?.type === "agent_message") {
            message = parsed.item.text ?? "";
          }
        } catch {
          // ignore non-JSON lines
        }
      }
      resolveCall({ ok: true, message: message.trim(), durationMs: Date.now() - startedAt });
    });
  });
}

// Read stdin completely (Claude Code passes the hook payload via stdin)
async function readStdin() {
  return new Promise((resolveRead) => {
    let data = "";
    process.stdin.on("data", (chunk) => {
      data += chunk.toString();
    });
    process.stdin.on("end", () => resolveRead(data));
    process.stdin.on("error", () => resolveRead(""));
  });
}

async function appendLog(entry) {
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch {
    // Logging failures should never break Claude's flow
  }
}

async function main() {
  // Parse the hook payload from stdin. Bail silently on malformed input.
  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = payload?.tool_name;
  if (!WATCHED_TOOLS.has(toolName)) {
    process.exit(0);
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath || typeof filePath !== "string") {
    process.exit(0);
  }

  // Read the file's current state (after the edit). If the tool just deleted
  // or moved the file, this read fails — log and pass.
  let fileContent;
  try {
    fileContent = await readFile(filePath, "utf8");
  } catch (err) {
    await appendLog({
      timestamp: new Date().toISOString(),
      tool: toolName,
      file: filePath,
      verdict: "skipped",
      reason: `unreadable: ${err.message}`,
    });
    process.exit(0);
  }

  // Skip files that aren't worth validating (assets, lockfiles, build output).
  // The benchmark explicitly tests on source code, so this is a coarse filter.
  const lower = filePath.toLowerCase();
  const skipPatterns = ["/node_modules/", "/dist/", "/.git/", "yarn.lock", "package-lock.json", ".png", ".jpg", ".jpeg", ".svg", ".ico"];
  if (skipPatterns.some((p) => lower.includes(p))) {
    process.exit(0);
  }

  // Hard limit on file size — gpt-5.5 reasoning on a 50KB file is wasteful for
  // this POC. Files larger than this are still logged, just skipped for codex.
  const MAX_FILE_BYTES = 20_000;
  if (fileContent.length > MAX_FILE_BYTES) {
    await appendLog({
      timestamp: new Date().toISOString(),
      tool: toolName,
      file: filePath,
      verdict: "skipped",
      reason: `file too large: ${fileContent.length} bytes`,
    });
    process.exit(0);
  }

  const projectContext = await readProjectContext();
  const prompt = buildPrompt({ filePath, fileContent, toolName, projectContext });
  const result = await runCodex(prompt);

  if (!result.ok) {
    await appendLog({
      timestamp: new Date().toISOString(),
      tool: toolName,
      file: filePath,
      verdict: "error",
      reason: result.reason,
      stderr: result.stderr,
      durationMs: result.durationMs,
    });
    process.exit(0);
  }

  const concerns = parseConcerns(result.message);
  const totalCount = concerns.high.length + concerns.med.length + concerns.low.length;
  const isNone = totalCount === 0;

  await appendLog({
    timestamp: new Date().toISOString(),
    tool: toolName,
    file: filePath,
    verdict: isNone ? "none" : "concerns",
    counts: {
      high: concerns.high.length,
      med: concerns.med.length,
      low: concerns.low.length,
    },
    durationMs: result.durationMs,
    raw: result.message.slice(0, 4000),
    concerns: {
      high: concerns.high.map((c) => c.slice(0, 800)),
      med: concerns.med.map((c) => c.slice(0, 800)),
      low: concerns.low.map((c) => c.slice(0, 800)),
    },
  });

  // Surface HIGH + MED to Claude via stderr; suppress LOW (it's in the log for
  // post-hoc analysis but not worth interrupting Claude's flow). The hook
  // (not the prompt) owns this threshold so it can be tuned without re-asking
  // codex to recalibrate its grading.
  const surfaced = [...concerns.high.map((c) => `[HIGH] ${c}`), ...concerns.med.map((c) => `[MED] ${c}`)];
  if (surfaced.length > 0) {
    process.stderr.write(`[codex-pair] ${filePath}\n${surfaced.join("\n\n")}\n`);
  }

  process.exit(0);
}

main().catch(async (err) => {
  await appendLog({
    timestamp: new Date().toISOString(),
    verdict: "error",
    reason: `unhandled: ${err?.message ?? String(err)}`,
  });
  process.exit(0);
});
