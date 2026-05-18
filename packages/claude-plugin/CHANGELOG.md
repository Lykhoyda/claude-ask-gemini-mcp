# @ask-llm/plugin

## 0.6.2

### Patch Changes

- Fix two ≥80-confidence findings from the multi-review on PR [#76](https://github.com/Lykhoyda/ask-llm/issues/76):

  **1. Catch handler now uses hoisted `markerAnchor` instead of `process.cwd()`** (both Gemini and Codex flagged). The unhandled-exception path in `main().catch(...)` previously walked up from `process.cwd()` to find the marker, which undermined the v0.6.1 cross-repo fix for any error that happened AFTER payload parsing. Now: `markerAnchor` is hoisted to module scope; `main()` sets it to `dirname(filePath)` once payload is validated; the catch handler reads `markerAnchor ?? process.cwd()` — using cwd only as a true last resort when `main()` threw before payload parsing.

  **2. Documented Windows compatibility caveat** for the `$PWD` workaround in `apps/docs/plugin/hooks.md`. The `sh -c '...'` form requires a POSIX shell, which Windows users on cmd.exe/PowerShell don't have natively. Added a one-line note pointing Windows users at Git for Windows (which provides `sh` via MINGW64) or recommending an absolute Windows path instead.

  Both fixes are tiny (~5 LOC each), no architectural changes. New structural test pins the catch-handler hoist invariant so a future refactor can't silently regress.

## 0.6.1

### Patch Changes

- Fix: codex-pair marker resolution now anchors to the edited file's directory, not `process.cwd()` (issue [#65](https://github.com/Lykhoyda/ask-llm/issues/65)). In multi-repo workflows where Claude Code's cwd is one repo but the edit happens in another, the previous behavior wrote logs to the cwd's repo instead of the edited file's repo, producing "where did my log go?" confusion. The fix uses `dirname(tool_input.file_path)` — always absolute per Claude Code's hook payload contract — as the marker walk's anchor. The `main().catch` unhandled-exception fallback retains its cwd-based lookup since `filePath` isn't in scope there; the structural test was tightened to allow this distinction.

  Side effect: shipping this as v0.6.1 also triggers Claude Code's plugin cache refresh for pre-existing sessions still pinned to the stale v0.6.0 install (issue [#74](https://github.com/Lykhoyda/ask-llm/issues/74)) — the next `/reload-plugins` or session restart will see "new version available" and re-fetch from origin.

## 0.6.0

### Minor Changes

- Prep v0.6.0 — codex-pair hook improvements release. Umbrella version covering a coordinated batch of hardening, observability, speed, and DX improvements to the codex-pair PostToolUse hook. Planned scope across three phases:

  **Phase 1 — Hardening + observability (bundled PR):**

  - Log rotation: cap `.codex-pair-log.jsonl` at ~2MB / 1000 entries via atomic rewrite (env override `CODEX_PAIR_MAX_LOG_BYTES`).
  - Structured run-state verdicts: explicit `none | concerns | skipped | error | spawn_failed | timeout | parse_failed | cached`, mirrored into the `systemMessage` prefix.
  - Expanded skip patterns: add font files, archives, language-specific lockfiles, minified assets.
  - Default-model drift guard: read model defaults from a shipped `codex-pair-defaults.json` instead of hardcoded literals; structural test links the file to `codex-mcp/constants.ts`.

  **Phase 2 — Foundation + adaptive context (sequential PRs):**

  - Local config in marker frontmatter: YAML frontmatter in `.codex-pair-context.md` for `model`, `fallbackModel`, `timeoutMs`, `maxFileBytes`, `surfaceThreshold`. Hand-rolled zero-dependency parser.
  - Adaptive context strategy at the file-size boundary: under-cap → full file (unchanged); over-cap + tracked → imports header + `git diff -U20 HEAD` + partial-view instruction; over-cap + untracked → head+tail slice with same instruction. Replaces today's silent skip.
  - `.codex-pair-ignore`: gitignore-style globs for granular per-file/per-directory opt-out, no `systemMessage` on match (preserves silent-gating UX).

  **Phase 3 — Speed + recovery (parallelizable PRs):**

  - Content-hash response cache: `sha256(model + prompt + fileContent + surfaceThreshold)` keyed cache under `<markerDir>/.codex-pair-cache/`, 10-minute TTL, 50-file LRU eviction.
  - Log viewer CLI: standalone `scripts/codex-pair-log.mjs` with `--latest`, `--summary`, `--file`, `--since` subcommands. Zero workspace imports.
  - Failure-class retry with jitter: retry-once on transient network/5xx errors (`ECONNRESET`, `ETIMEDOUT`, `502`/`503`/`504`, etc.). Quota and timeout failures keep their existing terminal paths.

  Constraints preserved through all items: zero workspace imports (marketplace install compatibility), always exit 0 (never break Claude's tool flow), LOW concerns stay in log only by default (ADR-077 threshold-in-hook), synchronous-blocking hook semantics (agent-accountability argument). Reasoning-effort tuning and async/fire-and-forget patterns are explicitly out of scope for this batch.

## 0.5.0

### Minor Changes

- codex-pair hook now emits a `systemMessage` notice to Claude Code on every run — `OK` when no concerns are found, `WARN` with HIGH/MED bodies when concerns surface, and `SKIP`/`ERROR` when the hook attempts work but can't complete (unreadable file, oversize file, codex timeout). Previously the hook was silent on the happy path, so review activity was only visible in `.codex-pair-log.jsonl`. The threshold-in-hook design from ADR-077 is preserved: LOW concern bodies still go to the log only, with a count surfaced in the verdict header.
