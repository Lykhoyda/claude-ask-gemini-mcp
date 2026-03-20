# Approach Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible benchmark comparing four approaches to external LLM consultation (Standalone MCP, Orchestrator MCP, Skill, Subagent), measuring token overhead, latency, and review quality.

**Architecture:** A static analysis script (`scripts/benchmark-overhead.ts`) imports provider tool registries and counts BPE tokens via `js-tiktoken`. Markdown docs define the manual run protocol, results template, and user recommendation guide. An S3 diff fixture ensures the large-scenario benchmark is immutable.

**Tech Stack:** TypeScript (ESM), js-tiktoken (cl100k_base), Vitest, existing monorepo packages

**Spec:** `docs/plans/2026-03-20-approach-benchmark-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `scripts/benchmark-overhead.ts` | Static token overhead analysis script |
| Create | `scripts/tsconfig.json` | TypeScript config for scripts directory |
| Create | `docs/benchmarks/PROTOCOL.md` | Manual run protocol with templates for 60 runs |
| Create | `docs/benchmarks/results.md` | Empty template for latency + quality results |
| Create | `docs/benchmarks/RECOMMENDATION.md` | User-facing decision guide |
| Create | `docs/benchmarks/fixtures/s3-codex-diff.patch` | Immutable large-diff fixture for S3 |
| Modify | `package.json` (root) | Add `js-tiktoken`, `tsx` devDependencies, `benchmark` script |
| Modify | `docs/ROADMAP.md` | Add benchmark entry |
| Modify | `docs/DECISIONS.md` | Add ADR-030 |

---

### Task 1: Install js-tiktoken and set up scripts directory

**Files:**
- Modify: `package.json` (root) — add `js-tiktoken` devDependency and `benchmark` script
- Create: `scripts/tsconfig.json` — TypeScript config for scripts

- [ ] **Step 1: Add js-tiktoken and tsx dependencies**

```bash
yarn add -D js-tiktoken tsx -W
```

- [ ] **Step 2: Add benchmark script to root package.json**

Add to the `"scripts"` section:
```json
"benchmark": "yarn build && npx tsx scripts/benchmark-overhead.ts"
```

- [ ] **Step 3: Create scripts/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/tsconfig.json yarn.lock
git commit -m "chore: add js-tiktoken and scripts config for benchmark tooling"
```

---

### Task 2: Build the static analysis script

**Files:**
- Create: `scripts/benchmark-overhead.ts`

This is the core deliverable — imports tool registries, counts BPE tokens, outputs comparison table.

- [ ] **Step 1: Create the benchmark script**

```typescript
#!/usr/bin/env node
/**
 * Static token overhead analysis for approach benchmark.
 * Prerequisite: yarn build (needs compiled dist/ from all packages).
 *
 * Usage: yarn benchmark
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { get_encoding } from "js-tiktoken";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// BPE tokenizer — cl100k_base is used by Claude models
const enc = get_encoding("cl100k_base");

function countTokens(text: string): number {
  return enc.encode(text).length;
}

// --- Step 1: Import provider registries (side-effect: pushes tools) ---
// Must import AFTER defining helpers since the import triggers module-level code.
// In the dev workspace (yarn workspaces), @ask-llm/shared resolves to a single
// copy via symlink, so toolRegistry is a shared singleton. This does NOT work
// with published bundledDependencies (each provider bundles its own copy).
// This script is intended for dev/monorepo use only.
const { toolRegistry } = await import("@ask-llm/shared");

const preGeminiCount = toolRegistry.length;
await import("ask-gemini-mcp/register");
const geminiToolCount = toolRegistry.length - preGeminiCount;

const preCodexCount = toolRegistry.length;
await import("ask-codex-mcp/register");
const codexToolCount = toolRegistry.length - preCodexCount;

// --- Step 2: Serialize and count tool schema tokens ---
interface ToolTokenInfo {
  name: string;
  tokens: number;
  json: string;
}

const toolTokens: ToolTokenInfo[] = toolRegistry.map((tool) => {
  // Match MCP SDK wire format — use Zod v4's toJSONSchema() for accurate schema
  const zodSchema = tool.zodSchema as { toJSONSchema?: () => unknown };
  const inputSchema = typeof zodSchema.toJSONSchema === "function"
    ? zodSchema.toJSONSchema()
    : (tool.zodSchema as { shape?: unknown }).shape ?? {};
  const schema = {
    name: tool.name,
    description: tool.description,
    inputSchema,
  };
  const json = JSON.stringify(schema, null, 2);
  return { name: tool.name, tokens: countTokens(json), json };
});

// --- Step 3: Read skill/subagent markdown files ---
const skillPath = resolve(ROOT, "packages/claude-plugin/skills/gemini-review/SKILL.md");
const agentPath = resolve(ROOT, "packages/claude-plugin/agents/gemini-reviewer.md");

const skillMarkdown = readFileSync(skillPath, "utf-8");
const agentMarkdown = readFileSync(agentPath, "utf-8");

const skillTokens = countTokens(skillMarkdown);
const agentTokens = countTokens(agentMarkdown);

// --- Step 4: Compute per-approach totals ---
// Tools are in registry order: gemini tools first, then codex tools
const geminiTools = toolTokens.slice(0, geminiToolCount);
const codexTools = toolTokens.slice(geminiToolCount, geminiToolCount + codexToolCount);

// Deduplicate by name (first wins — matches orchestrator behavior)
const seen = new Set<string>();
const uniqueTools: ToolTokenInfo[] = [];
for (const t of toolTokens) {
  if (!seen.has(t.name)) {
    seen.add(t.name);
    uniqueTools.push(t);
  }
}

const sumTokens = (tools: ToolTokenInfo[]) => tools.reduce((sum, t) => sum + t.tokens, 0);

const approaches = [
  {
    name: "Standalone Gemini",
    primaryContext: sumTokens(geminiTools),
    subagentContext: "-",
    details: geminiTools.map((t) => `${t.name}: ${t.tokens}`).join(", "),
  },
  {
    name: "Standalone Codex",
    primaryContext: sumTokens(codexTools),
    subagentContext: "-",
    details: codexTools.map((t) => `${t.name}: ${t.tokens}`).join(", "),
  },
  {
    name: "Orchestrator (both)",
    primaryContext: sumTokens(uniqueTools),
    subagentContext: "-",
    details: uniqueTools.map((t) => `${t.name}: ${t.tokens}`).join(", "),
  },
  {
    name: "Skill (/gemini-review)",
    primaryContext: sumTokens(geminiTools) + skillTokens,
    subagentContext: `${agentTokens + sumTokens(geminiTools)}`,
    details: `tools: ${sumTokens(geminiTools)}, skill.md: ${skillTokens}, agent.md: ${agentTokens}`,
  },
  {
    name: "Subagent (gemini-reviewer)",
    primaryContext: agentTokens + sumTokens(geminiTools),
    subagentContext: "-",
    details: `tools: ${sumTokens(geminiTools)}, agent.md: ${agentTokens}`,
  },
];

// --- Step 5: Output ---
console.log("\n## Tool Schema Token Counts\n");
console.log("| Tool | Tokens |");
console.log("|------|--------|");
for (const t of toolTokens) {
  console.log(`| ${t.name} | ${t.tokens} |`);
}

console.log(`\n## Markdown Prompt Token Counts\n`);
console.log(`| File | Tokens |`);
console.log(`|------|--------|`);
console.log(`| SKILL.md (gemini-review) | ${skillTokens} |`);
console.log(`| gemini-reviewer.md | ${agentTokens} |`);

console.log("\n## Per-Approach Overhead Comparison\n");
console.log("| Approach | Primary Context (tokens) | Subagent Context (tokens) | Breakdown |");
console.log("|----------|--------------------------|---------------------------|-----------|");
for (const a of approaches) {
  console.log(`| ${a.name} | ${a.primaryContext} | ${a.subagentContext} | ${a.details} |`);
}

// Compute delta vs standalone baseline
const standaloneBaseline = sumTokens(geminiTools);
console.log("\n## Overhead vs Standalone Gemini Baseline\n");
console.log("| Approach | Tokens | Delta | % Overhead |");
console.log("|----------|--------|-------|------------|");
for (const a of approaches) {
  const primary = typeof a.primaryContext === "number" ? a.primaryContext : 0;
  const delta = primary - standaloneBaseline;
  const pct = standaloneBaseline > 0 ? ((delta / standaloneBaseline) * 100).toFixed(1) : "N/A";
  console.log(`| ${a.name} | ${primary} | ${delta >= 0 ? "+" : ""}${delta} | ${delta >= 0 ? "+" : ""}${pct}% |`);
}

// --- Step 6: Write to file ---
const outDir = resolve(ROOT, "docs/benchmarks");
mkdirSync(outDir, { recursive: true });

const lines: string[] = [
  "# Token Overhead Comparison",
  "",
  `Generated: ${new Date().toISOString().split("T")[0]}`,
  "",
  "## Tool Schema Token Counts",
  "",
  "| Tool | Tokens |",
  "|------|--------|",
  ...toolTokens.map((t) => `| ${t.name} | ${t.tokens} |`),
  "",
  "## Markdown Prompt Token Counts",
  "",
  "| File | Tokens |",
  "|------|--------|",
  `| SKILL.md (gemini-review) | ${skillTokens} |`,
  `| gemini-reviewer.md | ${agentTokens} |`,
  "",
  "## Per-Approach Overhead Comparison",
  "",
  "| Approach | Primary Context (tokens) | Subagent Context (tokens) | Breakdown |",
  "|----------|--------------------------|---------------------------|-----------|",
  ...approaches.map(
    (a) => `| ${a.name} | ${a.primaryContext} | ${a.subagentContext} | ${a.details} |`,
  ),
  "",
  "## Overhead vs Standalone Gemini Baseline",
  "",
  "| Approach | Tokens | Delta | % Overhead |",
  "|----------|--------|-------|------------|",
  ...approaches.map((a) => {
    const primary = typeof a.primaryContext === "number" ? a.primaryContext : 0;
    const delta = primary - standaloneBaseline;
    const pct = standaloneBaseline > 0 ? ((delta / standaloneBaseline) * 100).toFixed(1) : "N/A";
    return `| ${a.name} | ${primary} | ${delta >= 0 ? "+" : ""}${delta} | ${delta >= 0 ? "+" : ""}${pct}% |`;
  }),
  "",
];

writeFileSync(resolve(outDir, "overhead.md"), lines.join("\n"));
console.log(`\nWritten to docs/benchmarks/overhead.md`);

enc.free();
```

- [ ] **Step 2: Verify the script runs**

```bash
yarn build && npx tsx scripts/benchmark-overhead.ts
```

Expected: Tables printed to stdout, `docs/benchmarks/overhead.md` created with token counts.

- [ ] **Step 3: Commit**

```bash
git add scripts/benchmark-overhead.ts docs/benchmarks/overhead.md
git commit -m "feat: add static token overhead benchmark script"
```

---

### Task 3: Generate S3 diff fixture

**Files:**
- Create: `docs/benchmarks/fixtures/s3-codex-diff.patch`

The codex-mcp and llm-mcp packages are currently untracked. We need to commit them first, then generate a diff fixture.

- [ ] **Step 1: Create fixtures directory**

```bash
mkdir -p docs/benchmarks/fixtures
```

- [ ] **Step 2: Generate the patch file**

Since codex-mcp is untracked, stage temporarily, generate the diff, then unstage:

```bash
git add packages/codex-mcp/
git diff --cached -- packages/codex-mcp/ > docs/benchmarks/fixtures/s3-codex-diff.patch
git reset -- packages/codex-mcp/
```

Verify the fixture has content:
```bash
wc -l docs/benchmarks/fixtures/s3-codex-diff.patch
```
Expected: ~900+ lines (all source, config, and test files for the codex-mcp package)

- [ ] **Step 3: Commit**

```bash
git add docs/benchmarks/fixtures/s3-codex-diff.patch
git commit -m "chore: add S3 benchmark fixture (codex-mcp diff)"
```

---

### Task 4: Write the manual run protocol

**Files:**
- Create: `docs/benchmarks/PROTOCOL.md`

- [ ] **Step 1: Write PROTOCOL.md**

```markdown
# Benchmark Run Protocol

Follow this protocol to collect latency and quality data for the approach comparison benchmark.

**Prerequisite:** All packages built (`yarn build`), Gemini CLI installed and authenticated.

## Scenarios

### S1: Small (~143 lines)
- **File:** `packages/shared/src/chunkCache.ts`
- **Prompt:** "Review @packages/shared/src/chunkCache.ts for bugs, edge cases, and potential improvements"

### S2: Medium (~355 lines)
- **File:** `packages/gemini-mcp/src/utils/geminiExecutor.ts`
- **Prompt:** "Review @packages/gemini-mcp/src/utils/geminiExecutor.ts for bugs, logic errors, and security concerns"

### S3: Large (~900+ lines diff)
- **File:** `docs/benchmarks/fixtures/s3-codex-diff.patch`
- **Prompt:** "Review this diff for bugs, missing edge cases, and architectural concerns: [paste patch contents]"

## Approaches

### A1: Standalone MCP (ask-gemini-mcp)
- **MCP config:** `claude mcp add gemini-cli -- npx -y ask-gemini-mcp`
- **Invocation:** Claude calls `ask-gemini` tool directly

### A2: Orchestrator MCP (ask-llm-mcp)
- **MCP config:** `claude mcp add ask-llm -- npx -y ask-llm-mcp`
- **Invocation:** Claude calls `ask-gemini` tool (loaded via orchestrator)

### A3: Skill (/gemini-review)
- **Plugin:** `claude plugin install packages/claude-plugin`
- **Invocation:** User types `/gemini-review`

### A4: Subagent (gemini-reviewer)
- **Plugin:** `claude plugin install packages/claude-plugin`
- **Invocation:** User asks Claude to "use the gemini-reviewer agent to review..."

## Run Template

Copy this template for each of the 60 runs (4 approaches × 3 scenarios × 5 runs).

```
### Run [N]

**Approach:** [A1 / A2 / A3 / A4]
**Scenario:** [S1 / S2 / S3]
**Run #:** [1-5]
**Date:** YYYY-MM-DD

#### Setup
1. Start fresh Claude Code session (no prior context)
2. Verify server: ping tool returns response
3. Note session start time: __:__

#### Execution
4. Paste exact scenario prompt
5. Wait for complete response

#### Measurements
- Wall-clock time (seconds): ___
- Gemini thinking tokens: ___
- Gemini input tokens: ___
- Gemini output tokens: ___

#### Quality Assessment
- Findings count: ___
- Critical/High findings: ___
- Medium/Low findings: ___
- Key findings summary:
  1. ___
  2. ___
  3. ___
```

## Aggregation

After completing all 60 runs, compute per approach × scenario:
- **Latency:** mean, min, max of 5 runs
- **Quality:** compare findings across approaches for the same scenario. Score: Equivalent / Mostly Equivalent / Divergent

Record aggregated results in `docs/benchmarks/results.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/benchmarks/PROTOCOL.md
git commit -m "docs: add benchmark manual run protocol"
```

---

### Task 5: Write the results template

**Files:**
- Create: `docs/benchmarks/results.md`

- [ ] **Step 1: Write results.md template**

```markdown
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

## Analysis

### Token Overhead
_(Copy from docs/benchmarks/overhead.md after running `yarn benchmark`)_

### Latency Findings
TBD — summarize patterns across scenarios

### Quality Findings
TBD — summarize parity across approaches

### Decision Tier
Based on the decision criteria in the spec:

| Metric | Value | Tier |
|--------|-------|------|
| Token overhead vs standalone | TBD% | TBD |
| Latency overhead vs standalone | TBD% | TBD |
| **Final tier** | | **TBD** |
```

- [ ] **Step 2: Commit**

```bash
git add docs/benchmarks/results.md
git commit -m "docs: add benchmark results template"
```

---

### Task 6: Write the user recommendation guide

**Files:**
- Create: `docs/benchmarks/RECOMMENDATION.md`

- [ ] **Step 1: Write RECOMMENDATION.md**

```markdown
# Which Approach Should You Use?

This guide helps you choose the right way to consult external LLMs (Gemini, Codex) from your AI coding tool.

## Quick Decision Tree

```
Are you using Claude Code?
├── No → Standalone MCP (ask-gemini-mcp or ask-codex-mcp)
│        Works with any MCP client: Cursor, Windsurf, Cline, etc.
│
└── Yes
    ├── Want both Gemini AND Codex in one server?
    │   → Orchestrator (ask-llm-mcp)
    │     One install, auto-detects available CLIs
    │
    ├── Want a one-command review workflow?
    │   → Skill: /gemini-review
    │     Gathers your diff automatically, delegates to Gemini
    │
    └── Want direct, low-overhead access?
        → Standalone MCP (ask-gemini-mcp)
          Lowest token overhead, fastest response
```

## Approach Comparison

| Approach | Install | Token Overhead | Latency | Works Outside Claude Code |
|----------|---------|---------------|---------|--------------------------|
| **Standalone MCP** | `npx -y ask-gemini-mcp` | Baseline | Baseline | Yes |
| **Orchestrator** | `npx -y ask-llm-mcp` | TBD% more | TBD% more | Yes |
| **Skill** | Plugin install | TBD% more (2 contexts) | TBD% more | No |
| **Subagent** | Plugin install | TBD% more | TBD% more | No |

_(Token overhead and latency numbers will be filled from benchmark results)_

## When to Use Each

### Standalone MCP (ask-gemini-mcp / ask-codex-mcp)
Best for: Users who want the lowest overhead and use a single LLM provider.
- Registers only 3 tools (ask-gemini, fetch-chunk, ping)
- Works with ANY MCP-compatible client
- Install: `claude mcp add gemini-cli -- npx -y ask-gemini-mcp`

### Orchestrator (ask-llm-mcp)
Best for: Users who want both Gemini AND Codex available in one server.
- Auto-detects installed CLIs at startup
- Registers tools only for available providers
- Install: `claude mcp add ask-llm -- npx -y ask-llm-mcp`

### Skill (/gemini-review)
Best for: Claude Code users who want a one-command code review workflow.
- Automatically gathers your git diff
- Delegates to a subagent for isolated review context
- Note: imposes costs in two context windows (primary + subagent)

### Subagent (gemini-reviewer)
Best for: Claude Code users who want an isolated review in a separate context.
- Runs in its own context window (doesn't pollute main conversation)
- Structured output format with severity rankings
```

- [ ] **Step 2: Commit**

```bash
git add docs/benchmarks/RECOMMENDATION.md
git commit -m "docs: add user recommendation guide for approach selection"
```

---

### Task 7: Update ROADMAP.md

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Add benchmark entry to roadmap**

After the existing "Cloud smoke tests" line in the Multi-LLM Support section, add:

```markdown
- [ ] **Benchmark** — token overhead + latency comparison of MCP vs Skill vs Subagent vs Orchestrator (ADR-030 pending results)
```

- [ ] **Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: add benchmark entry to roadmap"
```

---

### Task 8: Add ADR-030 to DECISIONS.md

**Files:**
- Modify: `docs/DECISIONS.md`

- [ ] **Step 1: Add ADR-030 at the top of DECISIONS.md (before ADR-029)**

```markdown
## ADR-030: Multi-Approach Benchmark (MCP vs Skill vs Subagent vs Orchestrator)
- **Date:** 2026-03-20
- **Status:** In Progress (static analysis complete, manual runs pending)
- **Context:** The project offers four approaches to external LLM consultation: Standalone MCP, Orchestrator MCP, Skill, and Subagent. ADR-024 was a one-off experiment on a single file. This formalizes the comparison with reproducible methodology across three metrics: token overhead, latency, and review quality.
- **Decision:** (1) Static analysis via `scripts/benchmark-overhead.ts` — imports tool registries from provider `./register` subpath exports, counts BPE tokens via `js-tiktoken` (cl100k_base). (2) Manual run protocol with 5 runs per approach per scenario (60 total) across three scenarios (small/medium/large). (3) Decision criteria: token overhead drives tier classification (<10% = default, 10-30% = multi-provider only, >30% = convenience option), latency is secondary filter. (4) Skill overhead reported per-window (primary + subagent) since costs burden different Claude instances.
- **Consequences:** Produces `docs/benchmarks/overhead.md` (static token costs), `docs/benchmarks/results.md` (latency + quality), and `docs/benchmarks/RECOMMENDATION.md` (user-facing decision tree). Results inform whether `ask-llm-mcp` is recommended as default or positioned as a convenience option.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DECISIONS.md
git commit -m "docs: add ADR-030 for multi-approach benchmark"
```

---

### Task 9: Run benchmark and verify output

**Files:**
- Verify: `docs/benchmarks/overhead.md` (generated by script)

- [ ] **Step 1: Build all packages**

```bash
yarn build
```

Expected: Clean build, no errors

- [ ] **Step 2: Run the benchmark script**

```bash
yarn benchmark
```

Expected: Token overhead tables printed to stdout with actual numbers. `docs/benchmarks/overhead.md` written.

- [ ] **Step 3: Review the output**

Verify:
- All 5 tools appear in the tool schema table (ask-gemini, fetch-chunk, ping, ask-codex, ping — with the second ping having a different token count than the first if descriptions differ)
- Skill and subagent markdown token counts are non-zero
- Per-approach totals are mathematically correct (sum of components)
- Overhead percentages look reasonable (orchestrator should be ~20-40% more than standalone gemini due to the extra ask-codex tool schema)

- [ ] **Step 4: Commit the generated output**

```bash
git add docs/benchmarks/overhead.md
git commit -m "docs: add generated token overhead comparison results"
```

---
