# Bug Reports

## Known Bugs (inherited from upstream)

### ~~Deprecated `-p` flag causes error~~ FIXED
- **Severity:** Critical
- **Upstream:** Issue #48, PRs #56, #43
- **Description:** Gemini CLI v0.23+ deprecated the `-p`/`--prompt` flag. Using it now produces "Cannot use both positional prompt and --prompt flag" error.
- **Fix:** Replaced `-p` flag with `--` separator + positional argument in `geminiExecutor.ts`

### ~~Windows ENOENT spawn errors~~ FIXED
- **Severity:** High
- **Upstream:** Issues #28, #30, #40; PRs #23, #27, #41, #43
- **Description:** `child_process.spawn()` fails on Windows because `gemini` resolves to `gemini.cmd`. Needs `shell: true` option and proper argument escaping.
- **Fix:** Added `shell: process.platform === "win32"` in `commandExecutor.ts`

### ~~Exit code 42: "No input provided via stdin"~~ FIXED
- **Severity:** Critical
- **Affected versions:** Gemini CLI v0.29.5+
- **Description:** After ADR-006 switched from `-p` flag to `--` separator for prompt passing, Gemini CLI v0.29.5 changed behavior so that positional arguments (via `--`) launch interactive mode expecting stdin. Since the MCP server spawns Gemini with `stdio: ["ignore", ...]`, stdin is closed and Gemini exits with code 42.
- **Fix:** Reverted to `-p` flag (`CLI.FLAGS.PROMPT = "-p"`) which triggers non-interactive headless mode. The v0.23 deprecation of `-p` was reversed in v0.29. See ADR-015.

### ~~Codex stdin pipe error in brainstorm-coordinator~~ FIXED
- **Severity:** High
- **Issue:** #19
- **Description:** Codex CLI fails with "stdin pipe error" when called from the brainstorm-coordinator agent. Works fine when called directly. Root cause: `commandExecutor.ts` used `stdio: ["ignore", ...]` which sets stdin to `/dev/null`. Codex CLI probes stdin during initialization — when spawned in agent sub-process context, `/dev/null` causes a broken pipe error.
- **Fix:** Changed stdin from `"ignore"` to `"pipe"` with immediate `.end()` in `commandExecutor.ts`. This gives the child process a proper EOF-terminated pipe instead of `/dev/null`. Added no-op error handler to prevent unhandled EPIPE if the child exits before stdin close completes.

### ~~Excessive token responses~~ WON'T FIX
- **Severity:** Medium
- **Upstream:** Issues #6, #26
- **Description:** MCP tool responses can exceed 45k tokens even for small prompts, consuming excessive context window.
- **Root cause:** Model-specific bug in `gemini-2.5-pro` — always returned ~45,735 tokens regardless of prompt size. Does not affect `gemini-3.1-pro-preview` (current default) or Flash models.
- **Mitigation:** Default model changed to `gemini-3.1-pro-preview`. Gemini CLI has no `--max-output-tokens` flag, so server-side truncation would be the only option — deemed unnecessary since the affected model is no longer the default.

### Missing changelog for v1.1.4
- **Severity:** Low
- **Upstream:** Issue #39
- **Description:** Published version has no release notes or changelog entry.

## Bugs Found via Code Review Experiment (ADR-024)

### ~~extractJson greedy first-match~~ FIXED
- **Severity:** Medium
- **Description:** `extractJson` returned the first valid JSON object found in Gemini CLI output, even if it was debug output (e.g., `{"retry":true}`) rather than the actual Gemini response. This could cause silent data loss when CLI debug lines contain JSON objects before the real response.
- **Fix:** After `JSON.parse` succeeds, check if parsed object has `response` or `error` field (Gemini-shaped). If not, save as fallback and continue searching. Return fallback only if no Gemini-shaped JSON found.

### ~~extractJson escape outside strings~~ FIXED
- **Severity:** Low
- **Description:** The `extractJson` parser tracked escape sequences (`\`) globally, not just inside JSON strings. A backslash in prefix text (e.g., Windows paths like `C:\new\file`) would set `escapeNext = true`, causing the next character to be skipped and corrupting brace/quote tracking.
- **Fix:** Changed escape detection from `if (char === "\\")` to `if (inString && char === "\\")`.

### ~~Thinking tokens not displayed in stats footer~~ FIXED
- **Severity:** Low
- **Description:** The `GeminiModelTokens` interface included a `thoughts` field and the Gemini CLI returns thinking token counts, but `formatStats` never displayed them. Users had no visibility into how many thinking tokens Gemini used.
- **Fix:** Added `if (tokens.thoughts != null && tokens.thoughts > 0) parts.push(...)` to `formatStats`, displayed between output tokens and cached count.

### ~~Gemini quota fallback fails with newer CLI versions~~ FIXED
- **Severity:** High
- **Issue:** #21
- **Description:** Gemini CLI changed its quota error format. Newer versions return `TerminalQuotaError: You have exhausted your capacity on this model` instead of `RESOURCE_EXHAUSTED`. The executor's fallback detection only matched the old format, so Pro → Flash fallback silently broke.
- **Fix:** Added `QUOTA_PATTERNS` array with three patterns (`RESOURCE_EXHAUSTED`, `TerminalQuotaError`, `exhausted your capacity`). Executor uses case-insensitive multi-pattern matching. See ADR-044.

### ~~Claude Desktop 4-minute timeout for Codex provider~~ FIXED
- **Severity:** High
- **Issue:** #20
- **Description:** Claude Desktop has a hard 4-minute client-side timeout. The server's default timeout was 5 minutes, so the client gave up before the server could return a meaningful error. The timeout handler also had a race condition — it killed the process but didn't immediately reject the promise.
- **Fix:** Lowered default timeout to 210s (3.5 min, below Claude Desktop's 4-min limit). Timeout handler now immediately rejects with actionable error message. See ADR-045.

## Shared Layer — Known Technical Debt

### ~~commandExecutor.ts contains Gemini-specific quota detection~~ FIXED
- **Severity:** Low
- **File:** `packages/shared/src/commandExecutor.ts`
- **Description:** The shared `executeCommand` function had Gemini-specific `RESOURCE_EXHAUSTED` detection hardcoded in the stderr handler.
- **Fix:** Added optional `onStderr` callback parameter to `executeCommand`. Moved Gemini quota detection into `geminiExecutor.ts` as the callback. The shared layer is now provider-agnostic.

## Bugs Found via Multi-Provider Review (/multi-review — Gemini + Codex)

### ~~ProgressHandle.stop() race condition~~ FIXED
- **Severity:** Critical (Gemini: 95, Codex: 90 — consensus)
- **Files:** `packages/{gemini,codex,ollama}-mcp/src/index.ts`, `packages/llm-mcp/src/index.ts`
- **Description:** `stop()` called `sendProgressNotification()` without awaiting the returned Promise. The MCP tool result was dispatched before the "100% completed" progress notification was sent, causing clients to show stale progress state.
- **Fix:** Made `stop()` async, updated `ProgressHandle` interface to `Promise<void>`, added `await handle.stop()` in all tool handlers. Then extracted into `@ask-llm/shared/progressTracker.ts`.

### ~~Hook temp file leak on signal interruption~~ FIXED
- **Severity:** Critical (Gemini: 90, Codex: 90 — consensus)
- **File:** `packages/claude-plugin/hooks/hooks.json`
- **Description:** Both hooks (Stop, PreToolUse) created temp files with `mktemp` but relied on a trailing `rm -f` for cleanup. If the `gemini` CLI was killed, interrupted, or the hook runner terminated early, the `rm` was never reached and temp files with diff content leaked in `/tmp/`.
- **Fix:** Added `trap 'rm -f "$tmp"' EXIT HUP INT TERM` immediately after `mktemp`.

### ~~Concurrent tool calls corrupt shared progress state~~ FIXED
- **Severity:** Critical
- **Files:** `packages/{gemini,codex,ollama}-mcp/src/index.ts`
- **Description:** Module-level mutable state (`isProcessing`, `currentOperationName`, `latestOutput`) was shared across all tool invocations. Two simultaneous MCP tool calls would interleave writes, corrupting progress messages.
- **Fix:** Replaced with `ProgressHandle` closure pattern — each tool invocation gets its own closure-scoped state. Then extracted to `@ask-llm/shared`.

## Claude Code Plugin — Known Limitations (from Gemini & Codex review)

### Untracked files not included in Stop hook review
- **Severity:** Medium
- **File:** `packages/claude-plugin/hooks/hooks.json`
- **Description:** `git diff HEAD` excludes untracked files. Sessions that only create new files get no review from the Stop hook. Accepted for v1 — reviewing diffs of existing files is the primary use case.

### Stop hook blocks until Gemini returns
- **Severity:** Medium
- **File:** `packages/claude-plugin/hooks/hooks.json`
- **Description:** The Stop hook runs synchronously, delaying session completion until Gemini responds. On large diffs this adds noticeable latency. Claude Code may not support `async` hooks yet — revisit when the platform adds support.

### Subagent inherits all tools (over-privileged)
- **Severity:** Low
- **File:** `packages/claude-plugin/agents/gemini-reviewer.md`
- **Description:** The gemini-reviewer subagent doesn't restrict its tool access. For a review-only agent, it has unnecessary write/edit capabilities. Low risk since the subagent runs in Claude's sandbox, but could be tightened by adding a `tools` allowlist if Claude Code supports it.

### Hook command is POSIX-only
- **Severity:** Low
- **File:** `packages/claude-plugin/hooks/hooks.json`
- **Description:** The shell command uses POSIX syntax (`if ! ...; then`, `2>/dev/null`, `${...}`). Won't work on Windows cmd.exe. Mirrors the broader platform gap — Claude Code hooks on Windows is an upstream concern.

### Subagent doesn't handle large diffs gracefully
- **Severity:** Low
- **File:** `packages/claude-plugin/agents/gemini-reviewer.md`
- **Description:** The review prompt template instructs the subagent to paste raw diffs into the Gemini prompt. For very large diffs, this could exceed Gemini's context window. Could be improved by instructing the subagent to use `fetch-chunk` or truncate.

## ~~Code Quality Issues (from utils/ audit)~~ ALL FIXED

All 10 code quality issues identified in the utils/ audit have been resolved:

- ~~No child process timeout~~ → Added 5min default timeout with SIGTERM→SIGKILL, configurable via `GMCPT_TIMEOUT_MS`
- ~~O(n^2) string concatenation~~ → Replaced with `Buffer[]` + `Buffer.concat()`
- ~~Broken @ symbol quoting~~ → Removed unnecessary quoting logic (`shell: false` means no shell expansion)
- ~~Raw Gemini output in error response~~ → Truncated to 2000 chars via `EXECUTION.ERROR_TRUNCATE_LENGTH`
- ~~Logger inconsistencies~~ → Removed `log()`, added level filtering, fixed `formatMessage`, `toolInvocation`, `toolParsedArgs`
- ~~Console.warn in changeModeParser~~ → Replaced with `Logger.warn`
- ~~Dead exported functions~~ → Deleted `summarizeChunking`, `getCacheStats`, `clearCache`
- ~~sendStatusMessage no-op~~ → Deleted, replaced call sites with `Logger.debug()`
- ~~processChangeModeOutput unnecessarily async~~ → Removed `async` keyword
