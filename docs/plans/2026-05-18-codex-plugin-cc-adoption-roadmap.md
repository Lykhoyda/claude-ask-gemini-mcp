# Codex-Plugin-CC Stability Pattern Adoption Roadmap

**Date:** 2026-05-18
**Status:** Draft (revised after multi-review against ADR-048)
**Goal:** Stabilize ask-llm's codex-pair hook by selectively adopting patterns from `openai/codex-plugin-cc`, sequenced across patch and minor releases. Each item carries an effort estimate, an ADR-dependency flag, and verified-against-source rationale.

## Current state (baseline)

- Plugin at **v0.6.2** on `main` (10-item umbrella batch + cross-repo marker fix + catch-handler hoist + Windows-docs note).
- 196 tests, all passing.
- Hook is `PostToolUse` on `Edit | Write | MultiEdit`, monolithic ~1115 LOC at `packages/claude-plugin/scripts/codex-pair-watch.mjs`.
- Reviews are sync-blocking per ADR-077 (agent-accountability property).
- Regex-parses HIGH/MED/LOW labels from codex's free-form output.
- Marker file `.codex-pair-context.md` is per-developer (gitignored) — opt-in by creating it locally.

## Empirical basis for this roadmap

1. **Phase 3B research** — I read `openai/codex-plugin-cc`'s source: `hooks.json`, `codex-companion.mjs` imports, `stop-review-gate-hook.mjs` (full source), `session-lifecycle-hook.mjs` header, `schemas/review-output.schema.json`, file inventory. The reference architecture is 5194 lines across `scripts/`, `lib/`, `tests/`.
2. **Multi-provider brainstorm** — Gemini and Codex independently ranked stability patterns by leverage and effort, with explicit ADR-077 / ADR-078 conflict analysis.
3. **Multi-review of the resulting plan** — both providers critiqued the synthesis, surfacing five risks I'd glossed over and one INVALIDATED recommendation.
4. **Source verification** — each ≥80-confidence reviewer claim was cross-checked against the repo's actual files / ADRs.

### Critical verified finding that revised the plan

**ADR-048 (2026-04-10) — "Remove Stop Hook from Claude Code Plugin"**: this project explicitly removed a Stop hook in the past because (a) `Stop` fires per-turn not per-session, generating 5–20 reviews of overlapping in-progress diffs per session and 60s UI blocks per turn, and (b) `git diff HEAD` excludes untracked files, silently undercovering new-file work. The ADR explicitly rejected `SessionEnd` (no such plugin event exists), debounce-as-band-aid, and widening the diff. **Conclusion**: the Stop migration recommendation I'd drafted is invalidated by our own prior experience. **Replacement**: debounce/coalesce on PostToolUse — same protection against half-built intermediate states without resurrecting ADR-048's noise problem.

### Pattern divergence summary (reference repo vs ask-llm)

| Dimension | codex-plugin-cc | ask-llm | Adoption verdict |
|---|---|---|---|
| Review trigger | `Stop` (per-turn, opt-in via config) | `PostToolUse` (per-edit) | Keep PostToolUse; add debounce |
| Output format | JSON schema-validated | Regex on HIGH/MED/LOW labels | **Adopt schema** (Tier 1) |
| Process model | Long-lived broker (codex `app-server`) | Spawn-per-call | Adopt later (Tier 2, ADR-required) |
| Code structure | 13 `lib/` files + thin scripts | 1115-LOC monolith | Targeted 3-5 lib extraction (Tier 2) |
| State | Persistent job records on disk | In-memory + log | Defer (Tier 3) |
| Cross-hook IPC | `$CLAUDE_ENV_FILE` (native) | None needed today | Adopt when broker arrives |
| Process cleanup | `terminateProcessTree` | Single SIGTERM | **Adopt** (Tier 1) |
| Testing | `fake-codex-fixture.mjs` (589 LOC) | PATH=nonexistent (~10 LOC) | **Adopt fixture** (Tier 1) |
| Prompt | Template files in `lib/prompts/` | Inline 700-char literal | Adopt later (Tier 2) |
| Hook timeout | Declared in `hooks.json` (seconds) | Env-var-only in script | Low-leverage; defer |

## Versioning strategy

Per-PR changeset bumping. Each ship event in this roadmap maps to one or more patch versions. ADR-required items get one version each; pure hardening items can bundle in a single patch.

---

## v0.6.3 — Tier 1 hardening (no architectural decision required)

**Scope:** Independent, low-risk hardening items that close known fragility classes. Bundle into one PR or split per item — your call. **Total estimated effort: ~2-3 days of focused work.**

### Items

- [ ] **1. Docs drift fix — `SKILL.md` vs `hooks.md` marker-commit contradiction**
  - **Where**: `packages/claude-plugin/skills/codex-pair/SKILL.md:44` (currently says "Commit `.codex-pair-context.md` to the repo"); `apps/docs/plugin/hooks.md:63` correctly says "Do NOT commit". The SKILL.md predates the gitignore decision.
  - **Action**: rewrite SKILL.md's commit guidance to match the now-canonical "per-developer, gitignored" model. Cross-reference issue/PR where the change happened.
  - **Effort**: **S** (~15 min). Pure docs.
  - **ADR**: none.

- [ ] **2. Fake-codex test fixture (PROMOTED from Tier 3)**
  - **Why first**: both reviewers (Gemini + Codex) flagged this as a prerequisite for safe parser/schema work. Refactoring the 1115-LOC monolith without a controllable codex mock risks silent regressions.
  - **Where**: `packages/claude-plugin/src/__tests__/_fixtures/fake-codex.mjs` (new). Lifecycle: spawn replacement that reads stdin, writes scripted JSONL response to stdout, exits with configured code. Configurable scenarios: NONE response, structured concerns, parse-failed, spawn_failed, timeout, quota fallback trigger, prompt-injection content.
  - **Test integration**: tests spawn the hook with `PATH` prepended to a directory containing the fake codex shim. Replaces our current `PATH=/nonexistent` hack.
  - **Effort**: **M** (~200 LOC fixture + ~3-5 test refactors).
  - **ADR**: none (test infrastructure).

- [ ] **3. Structured JSON contract for codex output (replaces regex parser)**
  - **Gated on**: fake-codex fixture (item 2) — to test the migration safely.
  - **Where**: new `packages/claude-plugin/schemas/review-output.schema.json` mirroring reference repo's shape (verdict, findings array with severity/file/line_start/line_end/confidence). Update prompt template to require JSON output. Replace `parseConcerns` regex with tolerant JSON parser + hand-rolled validator (no AJV — preserves ADR-078).
  - **Migration tests required** (per Codex reviewer): NONE, malformed JSON, extra prose, empty arrays, unknown severity, prompt-injection in reviewed file content.
  - **Parse-failed UX**: explicit `verdict: "parse_failed"` log entry + systemMessage, NOT silent fallback. Eliminates the "regex drift" class entirely.
  - **Effort**: **M** (~100 LOC contract + 50 LOC validator + ~10 migration tests).
  - **ADR**: ADR-083 documenting the output-contract migration + parse-failed UX.

- [ ] **4. Process-tree termination (cross-platform)**
  - **Where**: replace the current `child.kill("SIGTERM")` in `spawnCodex` with a helper that kills child + descendants. POSIX path uses `process.kill(-pid, signal)` after `detached: true` to make pid the process-group leader. Windows path uses `taskkill /pid <pid> /T /F`. Fall back to single-process kill if either path fails.
  - **Effort**: **M** (cross-platform reality — Gemini correctly flagged this is more complex than the S estimate).
  - **ADR**: none (standalone hardening).

- [ ] **5. Atomic state writes where missing**
  - **Audit**: `appendLog`, `setCachedConcerns`, `rotateLogIfNeeded` already do tmp+rename in some paths. Check log truncation in particular.
  - **Where**: any `writeFile` to a file that another concurrent hook invocation might also write. Replace with write-to-`.tmp` + `rename`.
  - **Effort**: **S** if audit confirms most paths are already atomic.
  - **ADR**: none.

### v0.6.3 success criteria

- Plugin test count ≥ baseline (currently 196).
- All 5 items shipped as separate commits or one bundled PR.
- Manual verification: parse-failed branch fires correctly when fake-codex returns malformed JSON.
- Process-tree termination tested on macOS at minimum; Windows path documented + tested in CI if feasible.

---

## v0.6.4–v0.7.0 — Tier 2 (ADR-level decisions required)

**Scope:** Architectural changes that need an ADR before implementation. Each item is a self-contained patch/minor depending on impact. **Total estimated effort: ~2-3 weeks of focused work depending on scope.**

### Items

- [ ] **6. Debounce / coalesce / single-flight on PostToolUse** (replaces dropped Stop migration)
  - **Why**: directly addresses the "rename across 3 files in one turn" false-positive class without resurrecting ADR-048's noise problem. Codex reviewer flagged this as the better alternative.
  - **Mechanism**: when a PostToolUse hook fires while a previous codex review on the same file is still in-flight (PID-tracked or content-hash-tracked), cancel-and-restart with the latest content, OR coalesce: queue the new edit's content and let the in-flight review finish, then review the latest cumulative content if it differs.
  - **ADR needed**: yes — review timing semantics + cancellation behavior + cache-key implications.
  - **Effort**: **M** (200-300 LOC + tests).

- [ ] **7. Targeted `lib/` extraction (3-5 files, not 13)**
  - **Goal**: enable real unit tests, not just regex-on-source structural tests.
  - **Candidate extractions**:
    1. `lib/parser.mjs` — `parseConcerns`, schema validator, JSON contract
    2. `lib/codex-spawn.mjs` — `spawnCodex`, `runCodexWithFallback`, `spawnCodexWithRetry`, `buildCodexArgs`
    3. `lib/git-diff.mjs` — `runGitDiff`, `buildAdaptiveContext`
    4. `lib/state.mjs` — log rotation, cache helpers, frontmatter parser
    5. `lib/process.mjs` — process-tree termination helper (from v0.6.3 item 4)
  - **ADR-078 implication**: relative imports inside the plugin are allowed (the constraint is "no workspace imports", not "no imports"). All extracted files ship inside `packages/claude-plugin/` and resolve relatively from the hook script.
  - **ADR needed**: yes — test strategy + module boundary rationale + bundler decision (do we bundle on publish or ship raw `.mjs` files?).
  - **Effort**: **M-L** (most of the work is rewriting structural-regex tests as real module tests).

- [ ] **8. Prompt template externalization with golden tests**
  - **Demoted from Tier 1**: Codex reviewer flagged that this is maintainability, not stability, UNLESS paired with golden prompt tests and explicit cache-key migration (current cache keys on rendered prompt — moving the template changes the key).
  - **Where**: `packages/claude-plugin/prompts/review.txt` + `loadPromptTemplate` helper. Golden tests assert prompt output for fixture inputs.
  - **Effort**: **M** with golden tests; **S** without.
  - **ADR**: small — prompt-template versioning + cache-key migration strategy.

- [ ] **9. App-server broker + SessionStart/SessionEnd lifecycle**
  - **Why**: codex `app-server` mode runs codex as a long-lived JSON-RPC server. Avoids the 5-30s cold-spawn cost per edit. Both reviewers agree this is the right LONG-term answer but it's a multi-week refactor with cross-platform IPC, lifecycle, version-skew, and concurrency concerns.
  - **Pre-work required**:
    - Verify codex CLI has stable `app-server` subcommand and JSON-RPC schema in our installed version.
    - Decide Unix socket vs TCP-with-auth-token (Windows compat — Unix sockets break on Windows per v0.6.2 work).
    - Health protocol + stale-PID cleanup (Codex reviewer added: atomic state writes + lock/ownership for the SessionStart race).
  - **ADR needed**: yes — transport choice, lifecycle ownership, failure modes (stale daemon, version skew, per-project context isolation, concurrent hook requests, cancellation).
  - **Effort**: **L** (1-2 weeks for the broker + lifecycle hooks + tests + cross-platform validation).

### Sequencing of Tier 2

Both reviewers converge on this order:

1. v0.6.3 lands first (Tier 1 hardening, includes fake-codex fixture).
2. Then **debounce/coalesce** (item 6) — quickest Tier 2 win, addresses an actual false-positive class.
3. Then **lib/ extraction** (item 7) — enables real tests, prerequisite for any larger refactor.
4. Then **prompt externalization** (item 8) — incremental.
5. Then **broker** (item 9) — only after the above stabilize.

---

## v0.7.0+ — Tier 3 (defer until specific need)

**Scope:** Features that would add complexity without clear stability benefit at current usage. Revisit when concrete demand surfaces.

- [ ] **Health check + stale-PID cleanup helpers** — gated on broker ADR (item 9).
- [ ] **Persistent job state** with `--background` / `--wait` modes — only if async review UX is needed.
- [ ] **Full fake-codex fixture extensions** (concurrency, multi-session, mid-stream interruption) — only if the basic fixture from item 2 proves insufficient.
- [ ] **Model aliases / reasoning-effort tunability** — feature creep per both reviewers; defer indefinitely.

---

## Out of scope (explicit non-goals)

- **Stop hook migration** — invalidated by ADR-048 (verified). Will not be revisited unless Claude Code exposes a true `SessionEnd` event AND we benchmark Stop against debounced PostToolUse with empirical data showing Stop wins.
- **Wholesale copy of codex-plugin-cc's 13-file `lib/` structure** — Gemini correctly flagged this as sprawl. Targeted 3-5 file extraction (item 7) is the right scale.
- **Async / fire-and-forget review pattern** — preserves ADR-077's sync-blocking property; breaks the "agent-accountability" guarantee.

---

## Cross-cutting risks the reviewers flagged

1. **`decision: block` auto-recovery** (Gemini, HIGH if Stop ships) — moot now Stop is dropped.
2. **Cross-platform IPC for broker** (Gemini, MEDIUM) — must plan TCP+auth or named pipes if broker ships.
3. **Schema-output false confidence** (Codex, MEDIUM) — mitigated by parse-failed UX (item 3).
4. **Concurrent hook invocations writing to shared files** (Codex, MEDIUM) — mitigated by atomic writes (item 5).
5. **Hook contract drift** (Codex, MEDIUM) — add tests pinning `systemMessage` / `continue` / future `decision:block` payload shapes.
6. **Strict timeout + graceful degradation** (Gemini, HIGH) — existing 800s timeout + SIGTERM/SIGKILL escalation already provides this. Re-audit when broker arrives.

---

## What to ship first

**v0.6.3 should start with the fake-codex fixture** (item 2). It's the prerequisite for safely shipping the schema migration (item 3), and both reviewers explicitly prioritized it. Without it, every downstream refactor risks silent regressions.

After fake-codex lands, the docs-drift fix (item 1), schema migration (item 3), and process-tree termination (item 4) can ship in parallel or bundled.

## ADRs to author during this work

- **ADR-083**: Output-contract migration — JSON schema, tolerant parser, parse-failed UX (paired with v0.6.3 item 3).
- **ADR-084**: PostToolUse debounce/coalesce semantics — cancellation rules, cache-key implications (paired with v0.6.4 item 6).
- **ADR-085**: Plugin module boundary policy — when to extract, bundler vs raw `.mjs` shipping (paired with v0.6.4 item 7).
- **ADR-086**: App-server broker transport + lifecycle — Unix vs TCP, health protocol, stale-PID cleanup (paired with v0.6.x or v0.7.0 item 9).

---

## References

- `openai/codex-plugin-cc` reference repo (commit at time of analysis): cloned to `/tmp/codex-plugin-cc/` from `git clone --depth 1 https://github.com/openai/codex-plugin-cc.git`.
- Multi-provider brainstorm + multi-review transcripts captured in conversation history (2026-05-18 session).
- `docs/DECISIONS.md` ADR-048 (Stop hook removal) — load-bearing prior experience.
- `docs/DECISIONS.md` ADR-077 (threshold-in-hook + sync-blocking).
- `docs/DECISIONS.md` ADR-078 (zero workspace imports).
- `docs/DECISIONS.md` ADR-079–ADR-082 (v0.6.0 batch architecture).
