# Benchmark Results

**Date:** TBD
**Operator:** TBD
**Gemini CLI version:** TBD

## Latency (wall-clock seconds)

### S1: Small (chunkCache.ts)

| Approach | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Mean | Min | Max |
|----------|-------|-------|-------|-------|-------|------|-----|-----|
| Standalone MCP | | | | | | | | |
| Orchestrator MCP | | | | | | | | |
| Skill | | | | | | | | |
| Subagent | | | | | | | | |

### S2: Medium (geminiExecutor.ts)

| Approach | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Mean | Min | Max |
|----------|-------|-------|-------|-------|-------|------|-----|-----|
| Standalone MCP | | | | | | | | |
| Orchestrator MCP | | | | | | | | |
| Skill | | | | | | | | |
| Subagent | | | | | | | | |

### S3: Large (codex-mcp diff)

| Approach | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Mean | Min | Max |
|----------|-------|-------|-------|-------|-------|------|-----|-----|
| Standalone MCP | | | | | | | | |
| Orchestrator MCP | | | | | | | | |
| Skill | | | | | | | | |
| Subagent | | | | | | | | |

## Quality Parity

| Scenario | Standalone vs Orchestrator | Standalone vs Skill | Standalone vs Subagent |
|----------|---------------------------|--------------------|-----------------------|
| S1 | | | |
| S2 | | | |
| S3 | | | |

Scores: Equivalent / Mostly Equivalent / Divergent

## Token Overhead (from static analysis)

See `docs/benchmarks/overhead.md` — generated via `yarn benchmark`.

| Approach | Total Tokens | vs Standalone Gemini |
|----------|-------------|---------------------|
| Orchestrator | 312 | -68% (unified ask-llm tool) |
| Standalone Codex | 411 | -58% (fewer tools) |
| Standalone Gemini | 973 | baseline |
| Subagent | 1274 | +31% |
| Skill | 1430 (primary) | +47% |

The orchestrator's unified `ask-llm` tool (240 tokens) + `ping` (72 tokens) = 312 tokens. This is 68% less than standalone Gemini because one tool schema replaces 3-4 individual provider tool schemas.

## Analysis

### Latency Findings
TBD

### Quality Findings
TBD

### Decision Tier
Based on the decision criteria in the spec:

| Metric | Value | Tier |
|--------|-------|------|
| Token overhead vs standalone | **-68%** | **Tier 1** (<10% — actually negative) |
| Latency overhead vs standalone | TBD% | TBD |
| **Final tier** | | **Tier 1 (pending latency)** |

**Finding:** After the unified `ask-llm` tool redesign (ADR-029 update), the orchestrator is the most token-efficient approach at 312 tokens — 68% less than standalone Gemini (973). This places it firmly in Tier 1 as the recommended default. Latency data from manual runs will confirm.
