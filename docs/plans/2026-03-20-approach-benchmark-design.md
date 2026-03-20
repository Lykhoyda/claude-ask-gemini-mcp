# Design: Multi-Approach Benchmark — MCP vs Skill vs Subagent vs Orchestrator

**Date:** 2026-03-20
**Status:** Approved
**Goal:** Produce a reproducible comparison of four approaches to external LLM consultation, measuring token overhead, latency, and review quality. Serves both as an internal evaluation of `ask-llm-mcp`'s value and a published user-facing guide.

## Problem

The ask-llm project now offers four distinct paths to the same outcome (getting a Gemini/Codex review):

1. **Standalone MCP** — `ask-gemini-mcp` or `ask-codex-mcp` directly
2. **Orchestrator MCP** — `ask-llm-mcp` (loads all available providers)
3. **Skill** — `/gemini-review` (delegates to subagent → MCP tool)
4. **Subagent** — `gemini-reviewer` agent (calls MCP tool directly)

Each adds different layers of overhead. Users and the maintainer need data to choose. ADR-024 was a one-off experiment comparing MCP/Skill/Subagent on a single file — this formalizes and expands it.

## Approaches Compared

| Approach | Call chain | Client support |
|----------|-----------|----------------|
| Standalone MCP | Claude → `ask-gemini` tool → Gemini CLI | Any MCP client |
| Orchestrator MCP | Claude → `ask-llm-mcp` → `ask-gemini` tool → Gemini CLI | Any MCP client |
| Skill | `/gemini-review` → subagent spawn → `ask-gemini` tool → Gemini CLI | Claude Code only |
| Subagent | `gemini-reviewer` agent → `ask-gemini` tool → Gemini CLI | Claude Code only |

All four ultimately invoke the same Gemini CLI. The variable is overhead layers.

## Metrics

### M1: Token Overhead (static, computed once)

These represent the permanent context cost each approach imposes on the calling LLM.

| Metric | Description | How to measure |
|--------|-------------|----------------|
| Tool schema tokens | JSON tool definition sent to Claude in every conversation turn | Serialize each tool's `{ name, description, inputSchema }` to JSON, count tokens via `js-tiktoken` (cl100k_base encoding) |
| Prompt template tokens | Skill markdown / subagent system prompt | Read file, count tokens via `js-tiktoken` |
| MCP framing tokens | Progress notifications, `content` wrapper, `isError` | Measure from a captured MCP exchange |
| Total idle cost | Schema tokens consumed just by having the approach configured (even if never called) | Sum of tool schemas for all registered tools |

**Key comparison:** Standalone Gemini registers 3 tools (ask-gemini, fetch-chunk, ping). Orchestrator registers 4 tools (ask-gemini, fetch-chunk, ask-codex, ping — duplicate ping from Codex is deduplicated). Skills/subagents impose costs across two separate context windows (see note below).

**Context window note for Skill approach:** The Skill imposes costs in two separate Claude context windows. The primary context pays for the skill markdown + tool schemas. The spawned subagent context pays for the subagent markdown + tool schemas (independently). These are reported per-window, not summed, since they burden different Claude instances.

| Approach | Primary context cost | Subagent context cost |
|----------|--------------------|-----------------------|
| Standalone MCP | Tool schemas only | N/A |
| Orchestrator MCP | Tool schemas only | N/A |
| Skill | Tool schemas + skill markdown | Subagent markdown + tool schemas |
| Subagent | Subagent markdown + tool schemas | N/A |

### M2: Latency (manual, 5 runs per approach per scenario)

Wall-clock time from user request to final formatted response. Includes:
- Claude processing time (prompt parsing, tool selection)
- MCP transport overhead (stdio serialization)
- Gemini CLI execution time
- Response parsing and formatting

5 runs per approach per scenario (4×3×5 = 60 runs). Report mean, min, and max per cell to account for Gemini CLI variance (ADR-024 showed up to 2.5x variance between approaches).

### M3: Review Quality (manual, qualitative)

For each test scenario, compare across approaches:
- **Findings parity:** Did all approaches identify the same issues?
- **Severity ranking:** Same prioritization?
- **Actionability:** Same level of specificity (file:line citations)?
- **Score:** Equivalent / Mostly equivalent / Divergent

Quality is assessed once per approach per scenario (not per run) — findings are expected to be consistent across runs of the same approach.

## Test Scenarios

Three scenarios of increasing complexity, using real code from this repository:

### S1: Small (~100 lines)
- **Target:** `packages/shared/src/chunkCache.ts`
- **Task:** "Review this file for bugs, edge cases, and potential improvements"
- **Expected findings:** TTL race conditions, SHA-256 collision probability, missing error on corrupt JSON

### S2: Medium (~400 lines)
- **Target:** `packages/gemini-mcp/src/utils/geminiExecutor.ts`
- **Task:** "Review this file for bugs, logic errors, and security concerns"
- **Expected findings:** Same bugs found in ADR-024 (extractJson issues, formatStats gap)
- **Rationale:** Direct comparison with prior experiment

### S3: Large (~1500 lines across multiple files)
- **Target:** Saved diff fixture at `docs/benchmarks/fixtures/s3-codex-diff.patch`
- **Preparation:** Before running the benchmark, generate the fixture: `git diff -- packages/codex-mcp/ > docs/benchmarks/fixtures/s3-codex-diff.patch` (or use `git diff <parent>..<commit> -- packages/codex-mcp/` once the codex-mcp work is committed). Check the fixture into the repo so all future runs use the same diff.
- **Task:** "Review this diff for bugs, missing edge cases, and architectural concerns"
- **Expected findings:** JSONL parsing edge cases, quota detection signals, module-level side effects

## Implementation

### Part 1: Static Analysis Script

**File:** `scripts/benchmark-overhead.ts`

**Prerequisite:** `yarn build` must be run first — the script imports compiled `.js` files from each provider's `dist/` directory via the `./register` subpath export.

**Mechanism:** The script imports each provider's `./register` subpath, which triggers a side-effect `toolRegistry.push(...)`. After all imports, it reads the populated `toolRegistry` array from `@ask-llm/shared` to access tool definitions.

**Token counting:** Uses `js-tiktoken` with `cl100k_base` encoding for accurate BPE token counts. Whitespace-split heuristics systematically under-count JSON schemas (which are dense with punctuation tokens). Added as a devDependency of the root workspace.

Steps:

1. Import `ask-gemini-mcp/register` (side-effect: pushes gemini tools to `toolRegistry`)
2. Snapshot `toolRegistry` length → gemini tool count
3. Import `ask-codex-mcp/register` (side-effect: pushes codex tools)
4. Read `toolRegistry` from `@ask-llm/shared` to get all tool definitions
5. Serialize each tool to JSON (matching MCP SDK's wire format: `{ name, description, inputSchema }`)
6. Count tokens via `js-tiktoken` for each serialized tool schema
7. Read skill and subagent markdown files from `packages/claude-plugin/`
8. Count tokens for markdown files
9. Compute per-approach totals:
   - **Standalone Gemini:** ask-gemini + fetch-chunk + ping tool schemas
   - **Standalone Codex:** ask-codex + ping tool schemas
   - **Orchestrator (both):** ask-gemini + fetch-chunk + ask-codex + ping tool schemas (4 unique tools)
   - **Skill (primary context):** tool schemas + skill markdown
   - **Skill (subagent context):** subagent markdown + tool schemas
   - **Subagent:** subagent markdown + tool schemas
10. Output comparison table to stdout and write `docs/benchmarks/overhead.md`

### Part 2: Manual Run Protocol

**File:** `docs/benchmarks/PROTOCOL.md`

A step-by-step checklist for running each approach on each scenario:

```
## Run Template

**Approach:** [Standalone MCP / Orchestrator / Skill / Subagent]
**Scenario:** [S1 / S2 / S3]
**Run #:** [1 / 2 / 3 / 4 / 5]

### Setup
1. Start fresh Claude Code session
2. Verify MCP server is connected: [tool name] ping
3. Note session start time

### Execution
4. Paste the exact prompt: "[scenario prompt]"
   - For S3: "Review this diff: [paste contents of docs/benchmarks/fixtures/s3-codex-diff.patch]"
5. Record wall-clock time to final response
6. Copy Gemini stats footer (input/output/thinking tokens)

### Results
- Wall-clock time: ___ seconds
- Gemini thinking tokens: ___
- Gemini input tokens: ___
- Gemini output tokens: ___
- Findings count: ___
- Findings list: [brief summary]
```

### Part 3: Results Analysis

**File:** `docs/benchmarks/results.md`

After running the protocol, aggregate results into:
- Table: approach × scenario × metric (mean, min, max of 5 runs)
- Chart-ready data (markdown table format)
- Statistical comparison: overhead delta vs standalone baseline
- Quality parity assessment per scenario

### Part 4: User Recommendation Guide

**File:** `docs/benchmarks/RECOMMENDATION.md`

Decision tree for users:

```
Are you using Claude Code?
├── No → Use standalone ask-gemini-mcp or ask-codex-mcp
└── Yes
    ├── Want both Gemini AND Codex? → ask-llm-mcp (orchestrator)
    ├── Want one-command review workflow? → /gemini-review skill
    └── Want direct control? → ask-gemini-mcp standalone
```

Include quantified overhead costs from the benchmark results.

## Decision Criteria for ask-llm-mcp

The orchestrator serves a real use case (multi-provider convenience in one MCP server). The benchmark determines how to position it:

| Tier | Token overhead vs standalone | Latency overhead vs standalone | Recommendation |
|------|------------------------------|-------------------------------|----------------|
| 1 | <10% | <20% | Default for new users |
| 2 | 10-30% | <50% | Multi-provider users only; standalone for single-provider |
| 3 | >30% | any | Convenience option with explicit trade-off warning |

Token overhead drives the tier classification. Latency is a secondary filter — if latency exceeds the bound for the token-based tier, move down one tier.

## Output Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Static analysis script | `scripts/benchmark-overhead.ts` | Reproducible token overhead measurement |
| S3 diff fixture | `docs/benchmarks/fixtures/s3-codex-diff.patch` | Immutable large-diff scenario |
| Protocol document | `docs/benchmarks/PROTOCOL.md` | Step-by-step manual run instructions |
| Overhead results | `docs/benchmarks/overhead.md` | Static token cost comparison table |
| Run results | `docs/benchmarks/results.md` | Latency + quality comparison |
| User guide | `docs/benchmarks/RECOMMENDATION.md` | Published decision tree |
| ADR-030 | `docs/DECISIONS.md` | Documents the benchmark methodology and conclusions |

## Non-Goals

- Benchmarking Gemini vs Codex quality (different LLMs, not comparable)
- Benchmarking response caching or streaming (future features)
- Automated CI benchmark suite (manual protocol is sufficient for 4×3×5 = 60 runs)
