---
"@ask-llm/plugin": patch
---

# ADR-097 — codex-pair UX hotfix on ADR-096

Closes the four `/multi-review` findings explicitly tracked as "follow-on hotfix
before wide adoption" in the v0.7.0 changeset. Both Gemini and Codex
independently flagged each at 80+ confidence; all four reproduced empirically
before fixing per the ADR-095 verify-before-fixing discipline.

1. **TOCTOU race on singleton `repetitions.json`** (Gemini 95, Codex 88) →
   state moves from `<markerDir>/.codex-pair/state/repetitions.json` to
   `<markerDir>/.codex-pair/state/repetitions/<sha256(file)[0:16]>.json`. Each
   shard's read-modify-write is now naturally serialized by ADR-087's per-file
   inflight lock. Schema bumped to `v: 2`.

2. **Unbounded state growth** (Codex 85) → `sweepStaleRepetitions` drops
   shards older than 30 days, called probabilistically (5% per update) so
   abandoned files don't accumulate state.

3. **Cache-hit double-count under rapid re-saves** (Gemini 87) → new
   read-only `getBlockingFromShard` surfaces blocking entries without
   mutating state. Cache-hit branch in `codex-pair-watch.mjs` uses this
   instead of `updateRepetitions`. Rapid undo/redo cycles can no longer
   push a finding to BLOCKING without a real new live review.

4. **Include-list negation-only edge case** (Codex 82) → `.codex-pair/include`
   with ONLY negation rules (e.g. just `!build/**`) previously gated every
   file out (no positive rule = no match for anything). Now the negations
   transform into positive ignore-list entries with an info-level log line
   explaining the semantic mapping.

Backward-compat shims keep the v1 `loadRepetitions`/`saveRepetitions` exports
as no-ops so external scripts that imported the v1 surface don't break at
import time. No data migration needed — repetition state is advisory and
regenerates from continued reviews; any lingering v1 `repetitions.json` file
on disk is harmless (different path, ignored by new code, won't be swept by
the new TTL).

Test count 308 → 313 (+5 ADR-097 regressions). Lint clean across 6 workspaces.
