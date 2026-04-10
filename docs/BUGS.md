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
- **Description:** Claude Desktop has a hard 4-minute client-side timeout. The server's default timeout was 5 minutes, so the client gave up before the server could return a meaningful error. Additionally, Codex CLI hung waiting for interactive approval prompts that can never arrive in MCP subprocess contexts.
- **Fix:** (1) Lowered default timeout to 210s (3.5 min, below Claude Desktop's 4-min limit). Timeout handler now immediately rejects with actionable error message. See ADR-045. (2) Added `--full-auto` flag to Codex CLI args so it never waits for approval. See ADR-046.

### ~~Node.js v18 incompatibility with gemini-cli~~ MITIGATED
- **Severity:** Medium
- **Issue:** Part of ANT-242
- **Description:** Claude Desktop may resolve a different Node.js binary (e.g., v18) than the user's shell. gemini-cli 0.36.0 uses ES2024 regex `v` flag which crashes on Node <20 with a cryptic `SyntaxError`.
- **Fix:** Added `Logger.checkNodeVersion()` at startup in all 4 servers. Logs error-level warning if Node <20 detected. See ADR-046.

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

### ~~npx -y ask-llm-mcp fails under npm 9 with EUNSUPPORTEDPROTOCOL workspace:*~~ RESOLVED (ADR-052)
- **Severity:** Critical
- **Files:** `packages/{gemini,codex,ollama,llm}-mcp/package.json`
- **Description:** Claude Desktop ships with Node 18 / npm 9.7.1. `npx -y ask-llm-mcp` (the recommended install command in `claude_desktop_config.json`) fails immediately with `npm ERR! code EUNSUPPORTEDPROTOCOL — Unsupported URL Type "workspace:": workspace:*` and the server never boots. Root cause: the published MCP packages had `"@ask-llm/shared": "workspace:*"` literally in their `dependencies` field. The `npm exec`/`npx` path fetches the registry manifest and parses its deps BEFORE downloading the tarball, so `bundledDependencies` doesn't help. Empirically reproduced on Node 18.15.0 / npm 9.7.1. Works fine on npm 10/11 (hence "works for me" pattern).
- **Resolution:** Added `scripts/prepack-bundle.mjs` + `scripts/postpack-restore.mjs` that rewrite `workspace:*` → `*` in the published tarball's package.json (both top-level and bundled nested ones) at pack time. Initially shipped in 1.5.6 / 0.2.6 with a `postpack` restore hook — this produced broken manifests because npm reads package.json for the registry manifest AFTER postpack restores (verified empirically: the 1.5.6 tarballs have `"*"` but the 1.5.6 registry manifests have `"workspace:*"`). Fixed by moving the restore from `postpack` to `postpublish` (runs after manifest upload). Published 1.5.7 / 0.2.7 with the correct lifecycle. **Users on 1.5.6 / 0.2.6 are still broken — they must update to 1.5.7 / 0.2.7 or later.** See ADR-052 for the full "postpack vs postpublish" analysis.

### ~~Untracked files not included in Stop hook review~~ RESOLVED (removed)
- **Severity:** Medium
- **File:** `packages/claude-plugin/hooks/hooks.json`
- **Description:** `git diff HEAD` excluded untracked files, so sessions that only created new files received no review.
- **Resolution:** Stop hook removed entirely in ADR-048 — the bug was structural (wrong trigger semantic), not a simple fix. `/gemini-review` slash command remains available for on-demand review.

### ~~Stop hook blocks until Gemini returns~~ RESOLVED (removed)
- **Severity:** Medium
- **File:** `packages/claude-plugin/hooks/hooks.json`
- **Description:** The Stop hook ran synchronously, delaying completion on every Claude turn (not just session end — `Stop` fires per-turn) until Gemini responded, adding up to 60s of latency.
- **Resolution:** Stop hook removed entirely in ADR-048. See the ADR for full rationale.

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
