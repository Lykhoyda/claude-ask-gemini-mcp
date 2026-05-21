# @ask-llm/plugin

## 0.7.0

### Minor Changes

- [#108](https://github.com/Lykhoyda/ask-llm/pull/108) [`190e5c9`](https://github.com/Lykhoyda/ask-llm/commit/190e5c9ee95b8241b0c788e3df2ea4fd3721b074) Thanks [@Lykhoyda](https://github.com/Lykhoyda)! - # v0.7.0 — Tier 3 broker, layout consolidation, codex-pair UX improvements

  Major release across the codex-pair feature: shipped the full Tier 3
  `codex app-server` broker (eliminates ~3-10s cold-spawn per edit when
  opted in via `ASK_CODEX_BROKER=1`), consolidated all hook state under
  a single `.codex-pair/` directory, removed the deprecated PreToolUse
  Gemini pre-commit hook, and added three codex-pair UX improvements
  born from end-of-Tier-3 lived-experience review.

  ## Highlights

  ### Tier 3 broker — `codex app-server` integration (ADR-093)

  A long-lived `codex app-server` JSON-RPC sidecar replaces the per-edit
  cold-spawn cost (15-30s) with a warm-connection path (~5-15s, savings
  of 3-10s per fire). Spawned once per Claude Code session, torn down at
  SessionEnd, with stale-broker recovery for crashed-session orphans.

  Implementation across four milestones:

  - **M1**: Protocol discovery via `codex app-server generate-json-schema`.
    Refined `lib/broker.mjs` interface; pinned `BROKER_PROTOCOL_VERSION =
"v2"`, `JSONRPC_METHODS`, `JSONRPC_NOTIFICATIONS`, `buildVerdictSchema()`.

  - **M2**: Hand-rolled minimal RFC 6455 WebSocket client (`broker-transport.
mjs`, ~280 LOC) supporting both `unix://` and `ws://`; JSON-RPC 2.0
    layer with tolerant parsing (`broker-rpc.mjs`); SessionStart spawn +
    handshake + atomic descriptor write; SessionEnd SIGTERM grace +
    cleanup; `clearStaleBrokerState` for orphan recovery (`broker-
lifecycle.mjs`).

  - **M3**: Real `submitReview` body — `thread/start { ephemeral: true,
approvalPolicy: "never", sandbox: "read-only" }` → `turn/start` with
    `outputSchema` constraint matching `parser.mjs::parseConcernsJson` →
    listen for `turn/completed` → extract final agentMessage → return.
    `rpc.waitFor(method, predicate, timeoutMs)` race-safe notification
    primitive. Error mapping via `err.verdict` (matches existing
    `verdictFromError` contract) with structured `err.timeout`,
    `err.aborted` markers.

  - **M4**: Hook integration. `isBrokerEnabled(markerDir)` checks env +
    descriptor + protocol version + pid liveness. `runCodexWithFallback`
    dispatches to the broker via `runWithBroker` when enabled; on
    `err.brokerFailure` (transport / handshake / parse failures) silently
    falls back to per-edit `spawnCodex` per the ADR-077 silent-on-error
    contract. Cache integration unchanged — broker and spawn modes share
    the same cache entries (cross-mode reuse is a feature).

  Opt-in via `ASK_CODEX_BROKER=1`. Default-off behavior byte-identical
  to v0.6.x.

  ### `.codex-pair/` layout consolidation (ADR-092)

  All hook state nested under a single project-local directory:

  | Before (flat)                 | After (nested)                |
  | ----------------------------- | ----------------------------- |
  | `.codex-pair-context.md`      | `.codex-pair/context.md`      |
  | `.codex-pair-log.jsonl`       | `.codex-pair/log.jsonl`       |
  | `.codex-pair-ignore`          | `.codex-pair/ignore`          |
  | `.codex-pair-cache/`          | `.codex-pair/cache/`          |
  | `.codex-pair-state/paused`    | `.codex-pair/state/paused`    |
  | `.codex-pair-state/inflight/` | `.codex-pair/state/inflight/` |

  `.gitignore` collapses from 4 enumerated codex-pair entries to one
  `.codex-pair/` line — future state files inherit the ignore
  automatically. Path-resolver pattern in `lib/state.mjs` is the single
  source of truth.

  **Migration for existing users**: manual `mv` of legacy flat paths into
  `.codex-pair/`. No migration helper ships; behavior is byte-identical
  to v0.6.x once paths are moved. Cache JSON shape, log JSONL shape,
  broker interface, atomicity contracts all unchanged.

  ### Codex-pair UX improvements (ADR-096)

  Three improvements identified from end-of-Tier-3 lived-experience
  review (ADR-095), targeting the 81% finding-ignored rate observed in
  real M2 development:

  1. **Inclusion-list scoping** (`.codex-pair/include`). Gitignore-style
     globs, mirror of `.codex-pair/ignore`. When present + non-empty,
     ONLY files matching at least one rule are reviewed. Lets users
     restrict codex-pair to high-stakes paths (`src/billing/**`,
     `src/auth/**`) and avoid paying ~$0.05/edit on routine refactor
     code. Include gate runs BEFORE ignore (include narrows; ignore
     excludes from narrowed set).

  2. **Repetition detector** (`.codex-pair/state/repetitions.json`).
     Tracks per-(file, concernHash) consecutive flag counts. Concerns
     absent from a re-review are dropped (assumed fixed); concerns
     present again increment. When count crosses `REPETITION_BLOCKING_
THRESHOLD` (3), the finding is escalated.

  3. **Loud-formatting** for repeated-ignored findings. When the
     threshold is crossed, `buildVerdictMessage` prefixes the
     systemMessage with a multi-line 🛑 banner so the consumer
     (Claude or human) cannot silently scroll past. Poor-man's STOPPER
     mode within PostToolUse hook constraints (Claude Code's hook
     protocol doesn't currently support blocking the next tool call).

  ### PreToolUse pre-commit Gemini hook removed (ADR-094)

  The advisory-only PreToolUse hook that ran Gemini against staged
  diffs has been removed:

  - Codex-pair delivers strictly better recall continuously during
    editing (HIGH/MED concerns surface to Claude on next turn; LOW
    concerns log).
  - `/gemini-review` covers the on-demand explicit-review need with
    the same Gemini-CLI dependency.
  - Removing eliminates per-Bash dispatch latency and simplifies the
    "what hooks does this plugin install?" model.

  **For users who relied on the advisory output**: switch to
  `git diff --cached | ask-gemini-run "review these staged changes"`
  or `/gemini-review` before committing. Both are documented in the
  README.

  ### Internal: codex-pair debt paydown + reviewer-agent calibration (ADR-095)

  End-of-Tier-2 forensic audit of `.codex-pair/log.jsonl` revealed
  codex-pair flagged 32 unique bugs during development; 21 were
  ignored in flight (2 of them BLOCKING — un-sent WebSocket upgrade

  - ESM `require()` — that `/multi-review` independently re-caught
    5+ hours later).

  * 6 verified-real bug fixes after empirical reproduction tracing
  * 1 documented false-positive (`child.unref()` is by design per ADR-090)
  * 3 deferred-known-limitations tracked in ROADMAP
  * `agents/codex-reviewer.md` calibration: severity-first reporting,
    mandatory reproduction paths, ADR-aware false-positive filtering,
    anti-noise heuristics

  ## What's not in this release (known follow-ons)

  - Full severity-vs-urgency refactor (breaking prompt + parser change).
  - True platform-level STOPPER signal (requires upstream Claude Code
    support for `decision: "block"` on PostToolUse).
  - Per-finding "acknowledged" persistence.
  - Multi-review ADR-096 findings (TOCTOU race on repetitions.json
    cross-file updates; unbounded state growth without TTL; include-list
    negation-only edge case; cache-hit double-count under rapid re-saves)
    — tracked for a follow-on hotfix before wide adoption.

  ## Test count trajectory

  230 → 245 (M2 PR1) → 254 (M2 PR2) → 264 (M2 PR3) → 271 (M2 hotfix [#103](https://github.com/Lykhoyda/ask-llm/issues/103))
  → 278 (ADR-095 debt) → 284 (M3) → 289 (M3 hotfix) → 300 (M4) → 308
  (ADR-096). All tests pass; lint clean across 6 workspaces.

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
