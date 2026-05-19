---
name: codex-pair
description: Continuous background Codex review on every file edit. Recall-first complement to /codex-review (which is precision-first). Opt-in per project via a `.codex-pair-context.md` marker file. Use when handling money, security-sensitive code, or implementing a written spec — domains where /codex-review's precision filter would suppress real concerns.
user_invocable: false
---

# Codex pair mode — recall-first background review

A PostToolUse hook that runs Codex against every file edit in opted-in projects. Surfaces HIGH and MED concerns to Claude on the next turn; logs everything to `.codex-pair-log.jsonl`. **Empirically catches a different class of bug than `/codex-review`** — see ADR-077 for the precision-vs-recall data.

This is NOT a slash command you invoke. It's a hook that runs automatically when its gate condition is met.

## When to use this vs `/codex-review`

| Use `/codex-review` (precision-first) | Use codex-pair (recall-first) |
|---|---|
| Routine PR review | Money/billing code |
| Glue code, CRUD, refactors | Security-sensitive paths (auth, untrusted input) |
| You want one comprehensive report | Implementing a written spec (RFC, protocol) |
| You're cost-sensitive (~$0.04/review) | Concurrency-heavy state management |
| Default for everything | Cost is acceptable (~$0.20/edit pass) |

The empirical finding from the 4-task benchmark: `/codex-review`'s "confidence ≥ 80" filter structurally suppresses domain-level "this is wrong but won't crash" issues (float-money precision, cross-cutting validation gaps, edge-case clamping). codex-pair's HIGH/MED/LOW threshold catches them. Different classes of bug, not the same class with different completeness.

## How to enable it

**Per-project opt-in.** Create a file named `.codex-pair-context.md` in your project root with project context for the reviewer:

```markdown
# .codex-pair-context.md

This is a payment-processing service. All currency calculations must use
integer cents internally (floating-point loses precision on every charge).
Concurrent requests are real. URL inputs are untrusted.

[Add any deployment shape, stated requirements, or threat surface the
reviewer should know when reasoning about a single file in isolation.]
```

The hook is always loaded by the plugin, but **self-gates on this file's presence**. No file → silent no-op (zero codex calls, zero cost). File present → every Edit/Write/MultiEdit triggers a codex review.

The marker file's *presence* is the switch; its *content* is the context codex needs to review intelligently. One artifact, two purposes.

**Do NOT commit `.codex-pair-context.md`** — gitignore it alongside the log and cache. The marker is per-developer opt-in: each contributor's review context is their own (model preference, severity threshold, project rules they care about). One developer iterating on prompt wording shouldn't dirty the shared history. The hook itself IS project policy (it ships in the plugin); the marker is the per-developer activation switch. Recommended `.gitignore` entries:

```
.codex-pair-context.md
.codex-pair-log.jsonl
.codex-pair-cache/
.codex-pair-state/
```

To onboard a new contributor, point them at this skill (or `apps/docs/plugin/hooks.md`) to write their own marker — or share a template via a separate (committed) `.codex-pair-context.example.md` they can copy and tweak locally.

## How to pause or disable

| Goal | How |
|---|---|
| Temporarily for this project (keep marker, keep project context) | `/codex-pair-pause` (resume with `/codex-pair-resume`) |
| Per-file/per-directory | Add patterns to `.codex-pair-ignore` (gitignore-style globs) |
| Permanently for this project | `rm .codex-pair-context.md` |
| Just this session | `/plugin disable ask-llm` |
| Just this command | `CODEX_PAIR_DISABLED=1 <whatever command>` |

`/codex-pair-pause` writes a `.codex-pair-state/paused` sentinel that the hook checks on every Edit/Write/MultiEdit; while present, the hook exits silently with a `verdict:"skipped"` log entry naming the pause. `/codex-pair-resume` removes the sentinel. The pause is per-project and per-developer — keep `.codex-pair-state/` in `.gitignore` alongside the marker, log, and cache.

## Behavior when active

```
Claude edits src/billing/charge.ts
        │
        ▼
  PostToolUse hook fires
        │
        ├─ Walk up from cwd looking for .codex-pair-context.md
        │
        ├─ NOT FOUND → exit silently (no codex call, no log)
        │
        └─ FOUND → read marker content as project context
                   ▼
                   Run codex review with HIGH/MED/LOW grading
                   ▼
                   Surface HIGH+MED to stderr (Claude reads next turn)
                   ▼
                   Log every call to .codex-pair-log.jsonl (incl. NONE verdicts)
```

## Cost characteristics

- ~$0.04–0.07 per file reviewed (gpt-5.5 with reasoning tokens)
- ~13–50s per file wall-clock
- Files >20 KB skipped (override with `CODEX_PAIR_MAX_FILE_BYTES`)
- node_modules, dist, lockfiles, images skipped automatically
- A 50-edit session = ~$2–3.50 + ~10–40 cumulative minutes of codex latency

For the typical opted-in project (small surface where review depth matters), this is acceptable. For routine refactor work, leave the marker file out.

## Output format

When codex surfaces concerns to Claude, they appear as system reminders on the next turn, prefixed with `[codex-pair]` and the file path. The full per-call log (including PASS verdicts and timing) is in `.codex-pair-log.jsonl` at the same directory as the marker file.

Example concern surface:

```
[codex-pair] src/billing/charge.ts

[HIGH] Monetary values are modeled as floating-point numbers
src/billing/charge.ts:12: `price` accepts arbitrary JS numbers for money,
which violates the stated requirement that currency uses integer cents.
Use integer minor units such as `priceCents: z.number().int().nonnegative()`.
```

## Configuration knobs (env vars)

| Variable | Default | Effect |
|---|---|---|
| `CODEX_PAIR_DISABLED` | unset | Set to `1` to bypass the hook entirely (kill switch) |
| `CODEX_PAIR_MAX_FILE_BYTES` | `20000` | Skip files larger than this many bytes |
| `ASK_CODEX_TIMEOUT_MS` | `800000` | Per-call codex timeout (inherited from ask-codex-mcp, ADR-074) |

## Empirical justification

The design decisions in this skill (HIGH/MED/LOW grading, marker-file gate, complement-not-replacement positioning) come from a 4-task benchmark documented in detail at branch `experiment/codex-pair-poc` and in [ADR-077](../../../../docs/DECISIONS.md). The headline result from the 3-arm comparison (task 4):

```
Claude alone:                    2/10 probes pass
Claude + /codex-review:          7/10 (missed: float-money, validation bypass, clamping)
Claude + codex-pair:            10/10
```

The three probes /codex-review missed are exactly the "domain-level wrong but won't crash" class that the precision filter suppresses. codex-pair fills that gap.
