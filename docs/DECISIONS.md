# Architectural Decisions

## ADR-036: Documentation Site Redesign (Dark-Only, Mastra-Inspired)
- **Date:** 2026-04-01
- **Status:** Accepted
- **Context:** The docs site (apps/docs/) was branded as "Ask Gemini MCP" with a blue (#4f8af7) accent, light/dark mode, and Manrope/Bricolage Grotesque fonts. The project has expanded to 4 providers (Gemini, Codex, Ollama, Unified) and needed a rebrand plus a premium developer-tool aesthetic. User requested a mastra.ai-inspired redesign.
- **Decision:** (1) Dark-only mode via `appearance: 'force-dark'` — removes the light mode toggle and all `html:not(.dark)` CSS (eliminated ~80 lines of dead code). (2) Indigo accent (#818CF8 primary, #6366F1 hover) replacing blue — chosen via Gemini consultation for "bridge/connector" semantics that is brand-neutral across providers. (3) Geist Mono as primary body font (`--vp-font-family-base`) with Geist Sans for headings — monospace-first aesthetic. (4) Design token system in `design-tokens.css` as single source of truth, with VitePress variable remapping. (5) Anti-grid chamfered corners via CSS `clip-path` polygon with layered `::before`/`::after` pseudo-elements (background + border layers) to solve the clip-path border clipping issue. (6) Per-provider accent colors (Gemini blue, Codex green, Ollama orange) with gradient-glow hover effects on provider cards. (7) Multi-provider navigation: Providers dropdown in nav, dedicated sidebar section, 4 new provider pages. (8) Rebranded to "Ask LLM" with multi-provider hero tagline.
- **Consequences:** The site is now dark-only (no light mode support). All 3 Vue components were rebuilt with token-based styling. 4 new provider pages created. The clip-path corner pattern requires the 2-pseudo-element approach for any new card components.

## ADR-035: Brainstorm Skill and Confidence-Based Review Agents
- **Date:** 2026-04-01
- **Status:** Accepted
- **Context:** The plugin had basic review agents (gemini-reviewer, codex-reviewer, ollama-reviewer) with simple prompt templates and no quality filtering. Users needed a way to consult multiple providers simultaneously for planning and design decisions. Anthropic's feature-dev plugin demonstrated a well-structured confidence-based code-reviewer and phased workflow approach.
- **Decision:** (1) Created `/brainstorm` skill + `brainstorm-coordinator` agent that sends a topic to multiple providers in parallel and synthesizes consensus points, unique insights, contradictions, and recommendations. Default providers: gemini,codex (avoids unnecessary Ollama calls). (2) Created `/brainstorm-all` shortcut that includes all providers including Ollama. (3) Upgraded all 3 review agents with confidence-based filtering (≥80 threshold) inspired by feature-dev's code-reviewer: 3-phase workflow (context gathering → prompt construction → synthesis), project-aware (reads CLAUDE.md conventions), output grouped by Critical (≥90) vs Important (80-89). (4) Provider list is configurable via skill arguments.
- **Consequences:** Users can now `/brainstorm` for multi-LLM consultation and get higher-quality reviews with confidence scores. The brainstorm workflow is a consultation pattern (not implementation) — complementary to feature-dev's implementation workflow.

## ADR-034: Gemini API Simplification (upstream PR #35)
- **Date:** 2026-03-31
- **Status:** Accepted
- **Context:** The `ask-gemini` tool exposed 8 parameters (prompt, model, sandbox, changeMode, sessionId, includeDirs, chunkIndex, chunkCacheKey). Most MCP clients only use `prompt`. The complex schema wasted tokens and increased hallucination risk (LLMs filling in parameters they shouldn't). Upstream PR #35 proposed a "compatibility mode" with simplified schemas.
- **Decision:** (1) Simplified `ask-gemini` to 2 parameters: `prompt` + `model` — matching the Codex and Ollama tool patterns. (2) Created `ask-gemini-edit` tool for structured code edits: `prompt` + `model` + `includeDirs`, with changeMode always enabled. (3) Removed `sandbox` and `sessionId` from tool schemas — sandbox is a niche feature, sessionId is returned in responses for manual use. (4) `chunkIndex`/`chunkCacheKey` remain exclusively in `fetch-chunk` where they belong (they were duplicated in the old ask-gemini schema). (5) The executor (`executeGeminiCLI`) retains full functionality — only the MCP-facing schema changed.
- **Consequences:** Primary tool drops from 8 params to 2 (significant token savings). Zero functionality lost — changeMode has its own dedicated tool, advanced executor options are still available programmatically. The Gemini MCP now exposes 4 tools: ask-gemini, ask-gemini-edit, fetch-chunk, ping.

## ADR-033: Cloud Smoke Tests
- **Date:** 2026-03-31
- **Status:** Accepted
- **Context:** All 173 unit tests use mocked executors — none verify real CLI/HTTP integrations. Upstream API changes, model deprecations, or CLI flag changes could silently break the tool.
- **Decision:** (1) Integration test files in each provider's `__tests__/integration.test.ts`, guarded by `SMOKE_TEST` env var via `describe.skipIf(!SMOKE)`. Normal `yarn test` skips them. (2) GitHub Actions workflow `.github/workflows/smoke.yml` with weekly schedule (Monday 06:00 UTC) + `workflow_dispatch` with provider selector input. (3) Three independent jobs: Gemini (installs `@google/gemini-cli`, auth via `GOOGLE_API_KEY` secret), Codex (installs `@openai/codex`, auth via `OPENAI_API_KEY` secret), Ollama (Docker service container `ollama/ollama`, pulls `qwen2.5-coder:1.5b`). (4) Summary job aggregates results into GitHub Step Summary with pass/fail/skip per provider. (5) Each test sends "What is 2+2?" and verifies response contains "4" — cheap, deterministic, validates the full path.
- **Trade-offs:** Weekly not nightly — saves API credits while still catching regressions within a week. Ollama uses the 1.5b model (not 7b default) to keep CI fast and image small. Secrets must be manually configured in repo settings.
- **Consequences:** First real end-to-end validation of the CLI/HTTP integrations. Requires `GOOGLE_API_KEY` and `OPENAI_API_KEY` repo secrets. Ollama job needs no secrets. Developers can run integration tests locally with `SMOKE_TEST=1 yarn workspace <pkg> run test`.

## ADR-032: Ollama MCP Package (ask-ollama-mcp)
- **Date:** 2026-03-30
- **Status:** Accepted (implements ADR-020 Phase 5)
- **Context:** ADR-020 approved multi-LLM provider packages. Phase 5 adds a local Ollama LLM provider, completing the trifecta of cloud CLI (Gemini), cloud CLI (Codex), and local HTTP (Ollama). Ollama runs models like qwen2.5-coder locally — no API keys needed.
- **Decision:** (1) HTTP executor using native `fetch` against `POST /api/chat` with `stream: false` — Ollama's `ollama run` CLI starts an interactive REPL unsuitable for programmatic use, so we bypass `executeCommand` entirely. (2) Default model `qwen2.5-coder:7b` with `qwen2.5-coder:1.5b` fallback on model-not-found errors (NOT quota errors — Ollama is local with no rate limits). (3) Base URL via `OLLAMA_HOST` env var (Ollama's own convention), defaulting to `http://localhost:11434`. (4) Availability detection via `GET /api/tags` HTTP probe with 2s timeout — unlike Gemini/Codex which use `which` to check CLI presence, Ollama requires the server to be running. (5) Extended `ProviderConfig` in `llm-mcp/constants.ts` with optional `availabilityModule` and `availabilityFn` fields for HTTP-based provider detection. (6) Tool annotations: `openWorldHint: false` (all computation is local, no external network calls). (7) Ping tool lists locally available models via `/api/tags`. (8) Added `"ollama"` to `UnifiedTool.category` union. (9) Claude plugin integration: ollama-run binary, ollama-reviewer agent, /ollama-review skill.
- **Trade-offs:** No streaming support (stream: false simplifies implementation; local inference is fast enough). No changeMode or sessions (local models don't benefit from these patterns designed for expensive remote APIs). Model-not-found signals use broad "not found" matching since Ollama's error format includes the model name between "model" and "not found".
- **Consequences:** 26 tests (executor + smoke), orchestrator updated to 3 providers. Users with Ollama installed get a free, private, offline AI review option alongside cloud providers. The `availabilityModule` pattern is extensible to future HTTP-based providers (LM Studio, vLLM).

## ADR-031: Claude Code Plugin — Codex Provider Support
- **Date:** 2026-03-28
- **Status:** Accepted
- **Context:** The Claude Code plugin (packages/claude-plugin) only supported Gemini. Phase 2 of the multi-LLM roadmap adds Codex as a second provider, mirroring the Gemini pattern.
- **Decision:** (1) Added ask-codex-run CLI binary (src/codex-run.ts) — calls executeCodexCLI directly, supports stdin piping, mirrors ask-gemini-run. (2) Added codex-reviewer subagent (agents/codex-reviewer.md) — isolated Codex review in separate context, same prompt template and output format as gemini-reviewer. (3) Added /codex-review skill (skills/codex-review/SKILL.md) — delegates to codex-reviewer agent. (4) Updated ProviderExecutor interface with command field and populated providers array with both Gemini and Codex entries using dynamic executor imports. (5) Added ask-codex-mcp as workspace dependency, added tsconfig reference to ../codex-mcp.
- **Consequences:** Claude Code users can now get second opinions from either Gemini or Codex. Hooks remain Gemini-only (the established workflow — users can customize). Ollama provider deferred to Phase 5.

## ADR-030: Multi-Approach Benchmark (MCP vs Skill vs Subagent vs Orchestrator)
- **Date:** 2026-03-20
- **Status:** In Progress (static analysis complete, manual runs pending)
- **Context:** The project offers four approaches to external LLM consultation: Standalone MCP, Orchestrator MCP, Skill, and Subagent. ADR-024 was a one-off experiment on a single file. This formalizes the comparison with reproducible methodology across three metrics: token overhead, latency, and review quality.
- **Decision:** (1) Static analysis via `scripts/benchmark-overhead.ts` — imports tool registries from provider `./register` subpath exports, counts BPE tokens via `js-tiktoken` (cl100k_base). (2) Manual run protocol with 5 runs per approach per scenario (60 total) across three scenarios (small/medium/large). (3) Decision criteria: token overhead drives tier classification (<10% = default, 10-30% = multi-provider only, >30% = convenience option), latency is secondary filter. (4) Skill overhead reported per-window (primary + subagent) since costs burden different Claude instances.
- **Findings (post-redesign):** Orchestrator: 312 tokens (-68% vs baseline). Standalone Codex: 411 tokens. Standalone Gemini: 973 tokens (baseline). Subagent: 1,274 tokens (+31%). Skill: 1,430 tokens (+47%). The unified `ask-llm` tool redesign made the orchestrator the most token-efficient approach (Tier 1). Latency data pending.
- **Consequences:** Produces `docs/benchmarks/overhead.md` (static token costs), `docs/benchmarks/results.md` (latency + quality), and `docs/benchmarks/RECOMMENDATION.md` (user-facing decision tree). Results inform whether `ask-llm-mcp` is recommended as default or positioned as a convenience option.

## ADR-029: Orchestrator MCP Package (ask-llm-mcp)
- **Date:** 2026-03-20
- **Status:** Accepted (implements ADR-020 Phase 4)
- **Context:** ADR-020 approved a unified orchestrator that registers tools from all available providers in one MCP server. Users install `ask-llm-mcp` instead of individual provider packages.
- **Decision (v2 — unified tool):** Redesigned after ADR-030 benchmark showed the original per-provider-tool approach added +42% token overhead. (1) Package at `packages/llm-mcp/` → npm `ask-llm-mcp`. (2) Single unified `ask-llm` tool with `provider` parameter (enum of available CLIs) + `prompt` + `model`. Replaces registering each provider's individual tools (which required 4+ tool schemas). (3) At startup, `isCommandAvailable()` checks each provider's CLI on PATH, then dynamically imports the executor function via `ask-<provider>-mcp/executor` subpath. (4) Provider enum in the tool schema is built from detected providers. (5) Routing: the `ask-llm` handler dispatches to the appropriate executor based on the `provider` field. (6) Token cost: 312 tokens total (ask-llm: 240 + ping: 72) — 68% less than standalone Gemini (973 tokens). (7) Startup logs available/missing providers to stderr.
- **Consequences:** The orchestrator is now the most token-efficient approach. Users get multi-provider access through one tool with minimal context overhead. Trade-off: provider-specific parameters (Gemini sandbox, changeMode, sessions) are not exposed through the unified tool — users needing those should use standalone MCP. 7 tests across 2 files.

## ADR-028: Codex MCP Package (ask-codex-mcp)
- **Date:** 2026-03-19
- **Status:** Accepted (implements ADR-020 Phase 3)
- **Context:** ADR-020 approved multi-LLM provider packages. Phase 3 adds OpenAI Codex CLI support as a standalone MCP server (`packages/codex-mcp/` → npm `ask-codex-mcp`), mirroring the proven `packages/gemini-mcp/` pattern.
- **Decision:** (1) Use `executeCommand` from `@ask-llm/shared` as the subprocess transport — the Gemini-specific `RESOURCE_EXHAUSTED` stderr handler in `commandExecutor.ts` is harmless dead code for Codex (never triggers). (2) Invoke Codex via `codex exec --skip-git-repo-check --ephemeral --json -m <model> "<prompt>"` — the prompt is a bare positional argument per official Codex CLI docs; `--quiet` and `--approval-mode` flags do not exist for `codex exec`. (3) Parse JSONL stdout: scan all lines, find the last `item.completed` event where `item.type === "agent_message"`, extract `item.text`. Error events are accumulated and thrown only if no `agent_message` was found (non-fatal errors during tool sub-steps don't discard the final response). Token stats from `turn.completed` events are appended as a stats footer. (4) Default model `gpt-5.4` with automatic fallback to `gpt-5.4-mini` on quota/rate-limit errors (signals: `rate_limit_exceeded`, `quota_exceeded`, `429`, `insufficient_quota`). (5) Added `"codex"` to the `UnifiedTool.category` union in `@ask-llm/shared/registry.ts`. (6) MCP Registry publishing ready via `mcpName` and `server.json`.
- **Reference implementations studied:** [cexll/codex-mcp-server](https://github.com/cexll/codex-mcp-server) (9 tools, `cross-spawn`, changeMode — too complex for our needs), [tuannvm/codex-mcp-server](https://github.com/tuannvm/codex-mcp-server) (simpler, captures raw stdout without `--json`). Both confirmed the bare positional prompt pattern and `--skip-git-repo-check` flag. Neither uses JSONL parsing.
- **Consequences:** Codex MCP is a standalone MCP server installable via `npx ask-codex-mcp`. 22 tests across 2 files. Zero changes to `gemini-mcp`. One 1-line change to `@ask-llm/shared` (category union). The `./executor` subpath export enables future plugin integration.

## ADR-027: Claude Code Plugin — Implementation of ADR-018
- **Date:** 2026-03-19
- **Status:** Accepted (implements ADR-018)
- **Context:** ADR-018 approved a hybrid multi-entrypoint architecture for the Claude Code plugin. This ADR documents the implementation decisions made during build-out in the `packages/claude-plugin` workspace package.
- **Decision:** Implemented 8 files across the plugin package: (1) `src/run.ts` — direct CLI binary that imports `executeGeminiCLI` via a new subpath export `ask-gemini-mcp/executor`. Reads stdin for piped diffs, joins CLI args and stdin with `filter(Boolean).join("\n\n")` to avoid leading newlines. Uses `console.error` instead of Logger to minimize dependency surface. (2) `agents/gemini-reviewer.md` — subagent with structured review prompt template and output format. (3) `skills/gemini-review/SKILL.md` — delegates to the gemini-reviewer agent to avoid prompt duplication (single source of truth). (4) `hooks/hooks.json` — Stop hook using `git diff HEAD --quiet` exit code (not fragile string matching) and `${CLAUDE_PLUGIN_ROOT}/dist/run.js` for PATH-independent binary resolution. (5) `.claude-plugin/plugin.json` — plugin manifest. (6) `.mcp.json` — MCP server config using `npx -y ask-gemini-mcp`. The subpath export in `gemini-mcp/package.json` uses the object form `{ types, default }` for proper TypeScript resolution under `moduleResolution: Node16`.
- **Consequences:** Plugin is installable via `claude plugin install`. MCP context (subagent, skill) and shell context (hooks) share the same core executor logic. Pre-commit hook implemented as a `PreToolUse` hook on the `Bash` tool — reads tool input from stdin, checks for `git commit` via grep, reviews staged diff (`git diff --cached`) through `run.js`, outputs review to stderr (advisory, exit 0 = never blocks). Same secret filtering and size cap (50KB) as the Stop hook.

## ADR-026: Yarn Workspaces Monorepo Restructure
- **Date:** 2026-03-18
- **Status:** Accepted (implements ADR-020)
- **Context:** The project was a single-package npm project. ADR-020 approved restructuring into a monorepo to support multiple LLM providers and a Claude Code plugin. The restructure was needed before adding new providers (Codex, Ollama) to avoid cross-cutting changes.
- **Decision:** Restructure into a Yarn 4 workspaces monorepo with `nodeLinker: node-modules` (not PnP, due to `createRequire` usage). Three packages: `packages/shared` (`@ask-llm/shared`, internal, not published) contains registry, logger, commandExecutor, changeMode parser/chunker/translator, chunkCache, base constants, and `BaseToolArguments`. `packages/gemini-mcp` (`ask-gemini-mcp`, published to npm) contains Gemini-specific constants (MODELS, CLI, ERROR_MESSAGES), tools, geminiExecutor, and MCP server entry points. `packages/plugin` (`@ask-llm/plugin`, placeholder) will support Gemini, Codex, and Ollama providers. TypeScript project references with `tsconfig.base.json` (`composite: true`) enable dependency-ordered builds. CI/CD updated from npm to yarn (`yarn install --immutable`, `yarn workspace ask-gemini-mcp npm publish`). The `workspace:*` protocol resolves to real versions during publish.
- **Consequences:** Existing `ask-gemini-mcp` npm users experience zero breakage — same package name, same version, same binary. All 99 tests pass across 6 test files (38 shared + 61 gemini-mcp). New providers plug in via shared registry. Root `yarn build/test/lint` orchestrates all packages.

## ADR-025: GitHub Actions Workflow Hardening for Fork PRs
- **Date:** 2026-03-03
- **Status:** Accepted
- **Context:** Claude Code Action (`anthropics/claude-code-action@v1`) uses OIDC tokens for authentication, which are not available on `pull_request` events from fork repositories. Additionally, the action internally runs `git fetch origin <branch>` for PR branches, which fails for fork branches since they don't exist on origin. This is a known upstream bug with 16+ open issues (e.g., [#962](https://github.com/anthropics/claude-code-action/issues/962), [#46](https://github.com/anthropics/claude-code-action/issues/46)). A code fix ([PR #963](https://github.com/anthropics/claude-code-action/pull/963)) is awaiting review.
- **Decision:** Split fork PR handling across two workflows: (1) `claude-code-review.yml` uses `pull_request_target` event with `github_token` (bypasses OIDC) and `allowed_non_write_users: "*"` (allows fork contributors). Safe because the review prompt is read-only (`gh pr diff`, never checks out fork code). Pattern validated against [pzmarzly/demo--claude-bot-reviews](https://github.com/pzmarzly/demo--claude-bot-reviews). (2) `claude.yml` detects fork PRs via GitHub API and gracefully skips with an explanatory comment instead of crashing. Also updated all workflows to actions/checkout@v6, setup-node@v6, upload-pages-artifact@v4; added lint step to CI; removed `continue-on-error: true` on test step.
- **Consequences:** Auto-review works for all PRs including forks. `@claude` mentions gracefully degrade on fork PRs with a helpful message. CI now fails properly on test or lint failures instead of silently passing.

## ADR-024: MCP vs Skill vs Subagent Context Comparison Experiment
- **Date:** 2026-03-01
- **Status:** Informational
- **Context:** To understand how different Claude Code invocation methods affect Gemini's code review quality, we ran the same code review task through three approaches: MCP tool call (structured template with explicit instructions), Skill (markdown skill file with checklist), and Subagent (general-purpose agent with natural language prompt). Each approach produced a review of the same `geminiExecutor.ts` file.
- **Finding:** Prompt structure inversely correlates with Gemini thinking tokens. The structured MCP template (explicit fields, numbered instructions) produced 6,666 thinking tokens in 74s. The Skill approach (markdown checklist) produced 8,942 thinking tokens in 118s. The raw Subagent prompt (unstructured natural language) produced 16,617 thinking tokens in 212s — 2.5x more thinking than MCP for comparable review quality.
- **Decision:** Document findings for future prompt engineering decisions. All three approaches found the same three actionable bugs (extractJson greedy first-match, extractJson escape-outside-string, missing thinking tokens in formatStats), suggesting review quality is consistent regardless of thinking token count.
- **Consequences:** When optimizing for speed/cost, prefer structured prompts with explicit output format instructions. When optimizing for thoroughness on novel problems, less-structured prompts may explore more reasoning paths. No code changes from this ADR.

## ADR-023: MCP Tool Annotations
- **Date:** 2026-03-01
- **Status:** Accepted
- **Context:** The MCP spec defines `ToolAnnotations` (title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint) to describe tool behavior to clients. SDK v1.27.0 supports annotations in `registerTool()`.
- **Decision:** Add `annotations?: ToolAnnotations` to the `UnifiedTool` interface. Forward it to `server.registerTool()`. Set annotations on all 3 tools: `ask-gemini` (read-write, non-destructive, open-world), `fetch-chunk` (read-only, idempotent, closed-world), `ping` (read-only, idempotent, closed-world).
- **Consequences:** MCP clients can make informed decisions about tool auto-approval and risk levels. No behavioral changes.

## ADR-022: Include Additional Directories via --include-directories
- **Date:** 2026-02-27
- **Status:** Accepted
- **Context:** Gemini CLI supports `--include-directories <path>` to extend its file access beyond the current working directory. This is the primary way to support monorepos where relevant code lives in sibling packages. The flag can be repeated for multiple directories.
- **Decision:** Add `includeDirs?: string[]` as an optional array parameter to `ask-gemini`. In `buildArgs()`, emit one `--include-directories <dir>` pair per entry (repeated-flag form, avoiding comma-in-path edge cases). No upper limit enforced — the CLI enforces its own constraints. Parameter forwarded in both primary and quota-fallback call paths.
- **Consequences:** Users can point Gemini at multiple directories outside CWD. 94 tests pass.

## ADR-021: Multi-Turn Session Support via --resume
- **Date:** 2026-02-26
- **Status:** Accepted
- **Context:** The Gemini CLI supports multi-turn sessions via `--resume <sessionId>`. The `--output-format json` response includes `session_id` at the top level. Combining `--resume <uuid> -p "prompt"` works for headless multi-turn. Verified on Gemini CLI v0.30.0.
- **Decision:** Add `sessionId` as optional parameter to `ask-gemini` tool. Pass `--resume <sessionId>` when provided. Extract `session_id` from JSON response and embed as `[Session ID: <uuid>]` footer in the response text. Refactored `executeGeminiCLI` from 5 positional params to an options object (`GeminiExecutorOptions`), returning structured `GeminiExecutorResult`. Extracted `buildArgs()` to deduplicate primary/fallback arg construction. Fixed `GeminiJsonResponse.stats` to match real CLI output (nested `stats.models[name].tokens` structure, not the flat `inputTokens`/`outputTokens` from the original ADR-019 design doc).
- **Consequences:** Claude can maintain multi-turn conversations with Gemini across tool calls. Stats footer now correctly displays token counts from the real CLI JSON. The options-object refactor makes adding future CLI flags trivial. All 88 tests pass.

## ADR-020: Multi-LLM MCP Server (ask-llm-mcp)
- **Date:** 2026-02-26
- **Status:** Approved (implementation deferred until Gemini improvements complete)
- **Context:** The tool only supports Gemini CLI. Developers using different AI coding tools (Claude Code, OpenCode, Codex) want to consult multiple LLMs. MCP was chosen over Claude Code skills/subagents for universal client compatibility.
- **Decision:** Restructure into a yarn workspaces monorepo with individual provider packages (ask-gemini-mcp, ask-codex-mcp) and an orchestrator (ask-llm-mcp). Shared code in internal @ask-llm/shared package. Each provider is a standalone MCP server. Separate tools per provider (not a unified ask-llm tool) for easier subagent wiring.
- **Consequences:** Existing ask-gemini-mcp users see zero breakage. New providers plug in via ProviderExecutor interface. Ollama support deferred to v2 with Docker integration tests.
- **Design doc:** [docs/plans/2026-02-26-ask-llm-mcp-design.md](plans/2026-02-26-ask-llm-mcp-design.md)

## ADR-001: Fork from jamubc/gemini-mcp-tool
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** Original repo has 13 open PRs and 13 open issues with no maintainer activity. Active users are contributing features and fixes that remain unmerged.
- **Decision:** Fork the repo to give it a second life, merge community contributions, and continue development.
- **Consequences:** Need to evaluate each upstream PR for quality and compatibility before merging. Must update package metadata to reflect new maintainership.

## ADR-002: Clean README and Remove Previous Owner References
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** After forking, all repo metadata, README, docs, and sponsorship links still pointed to the previous owner (jamubc). The README listed stale tools (sandbox-test) and included a Glama badge for the old repo.
- **Decision:** Rewrite README focused on actual use cases (second opinion, plan debate, change review). Remove all jamubc sponsorship/funding content. Update package.json, LICENSE, docs links, and deploy scripts to reference `Lykhoyda/claude-ask-gemini-mcp`. Delete `docs/funding.md`.
- **Consequences:** Clean separation from upstream. Docs funding page no longer exists (Vue components that linked to it now point to the GitHub repo instead). Deploy scripts reference new wiki URL.

## ADR-003: Remove Unused Dependencies and Dead Code
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The forked codebase included several npm dependencies (`ai`, `chalk`, `d3-shape`, `inquirer`, `archiver`) that are not imported or used anywhere in the source code. Additionally, `src/utils/timeoutManager.ts` was an empty file, and `package.json` referenced a `contribute` script targeting a non-existent file. Documentation referenced non-existent slash commands (`/gemini-cli:analyze`, `/gemini-cli:sandbox`) and fabricated sandbox capabilities.
- **Decision:** Remove all unused production dependencies. Move `prismjs` to devDependencies (only used in VitePress docs). Delete empty/orphaned files. Update documentation to accurately reflect the actual tools and their behavior.
- **Consequences:** Smaller install footprint. Fewer security audit warnings. Documentation now accurately reflects the codebase.

## ADR-004: Remove Non-Core Tools (Brainstorm, Sandbox, Help)
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The original MCP server design included multiple specialized tools (e.g., `brainstorm`) and diagnostic tools (`timeout-test`, `help`). These added unnecessary constraints and codebase complexity, as models like Claude can execute advanced brainstorms or system evaluations perfectly fine using just the standard `ask-gemini` tool.
- **Decision:** Delete all non-core tool implementations (`brainstorm.tool.ts`, `timeout-test.tool.ts`, `test-tool.example.ts`) and strip the `help` tool. Restrict the MCP server to exposing exclusively `ask-gemini` (the primary read/write bridge), `fetch-chunk` (for paginating large cached responses), and `ping` (retained specifically as a fast UX diagnostic tool to verify the MCP setup without using Gemini tokens).
- **Consequences:** The registry is vastly simplified. Hallucinated or low-value interactions are removed from the tool schema, improving context utilization and reducing the risk of tool usage errors when LLMs explore the configuration.
## ADR-005: Upgrade MCP SDK to v1.x and Raise Node.js Minimum to 18
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The `@modelcontextprotocol/sdk` was pinned at v0.5.0 while v1.26.0 is current. All import paths and APIs used by this project are preserved in v1.x. Node.js 16 reached EOL in September 2023. The `notifications` capability key was removed from `ServerCapabilities` in v1.x.
- **Decision:** Upgrade SDK to ^1.26.0, raise minimum Node.js to >=18, update CI matrix to test 18/20/22, remove the `notifications: {}` capability from server init. Zod v4 upgrade deferred — the SDK peer dependency is satisfied by current zod v3.25.76. The `Server` class is deprecated in favor of `McpServer` but still functional; migration deferred to avoid a large refactor.
- **Consequences:** Access to latest MCP protocol features. Larger transitive dependency footprint (SDK v1.x bundles HTTP/OAuth libraries not used by this stdio-only server). Node 16 users will need to upgrade.

## ADR-006: Utils Audit — Replace `-p` Flag with `--` Separator
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** Gemini CLI v0.23+ deprecated the `-p`/`--prompt` flag (upstream issue #48, PRs #56, #43). Using it causes "Cannot use both positional prompt and --prompt flag" errors. The `--` separator is the standard POSIX way to pass positional arguments after flags.
- **Decision:** Replace `CLI.FLAGS.PROMPT = "-p"` with `CLI.FLAGS.SEPARATOR = "--"` in constants. Update both main and fallback code paths in `geminiExecutor.ts`. Remove the broken `@` symbol quoting logic (unnecessary since `shell: false` means no shell expansion).
- **Consequences:** Fixes the critical CLI compatibility bug. Simplifies argument construction. Users on Gemini CLI v0.23+ can now use the tool without errors.

## ADR-007: Utils Audit — Add Process Timeout and Windows Compatibility
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** `executeCommand` had no timeout mechanism — a hung Gemini CLI process would leak indefinitely. On Windows, `spawn("gemini", ...)` fails with ENOENT because it resolves to `gemini.cmd`.
- **Decision:** Add configurable timeout: 5-minute default, overridable via `GMCPT_TIMEOUT_MS` env var. On timeout, send SIGTERM, then SIGKILL after 5s grace period. Add `shell: process.platform === "win32"` to spawn options. Replace O(n^2) `stdout += data` with `Buffer[]` array + `Buffer.concat()` at process close.
- **Consequences:** Prevents resource leaks from hung processes. Windows users can now use the tool. Large Gemini responses no longer cause quadratic memory allocation.

## ADR-008: Utils Audit — Logger Rewrite with Level Filtering
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The Logger class had multiple issues: `log()` and `warn()` were identical, `debug()` always printed (no filtering), `toolInvocation` ignored its `toolName` param, `formatMessage` added trailing `\n` causing double-newlines, and `_commandStartTimes` was keyed by `Date.now()` risking key collisions.
- **Decision:** Add log level filtering via `GMCPT_LOG_LEVEL` env var (debug/info/warn/error, default: warn). Remove `log()` method. Fix `formatMessage` to not add `\n`. Fix `toolInvocation` and `toolParsedArgs` to include all params. Replace timestamp-keyed map with incrementing `_nextCommandId` counter. Change `commandExecution` to return `number` (command ID). Change `...args: any[]` to `...args: unknown[]`.
- **Consequences:** Debug output is now silent by default, reducing noise. Command tracking is collision-free. All logger methods are type-safe. Users can increase verbosity via env var for debugging.

## ADR-009: Utils Audit — Dead Code Removal and Minor Fixes
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** Multiple dead exports existed: `summarizeChunking` (changeModeChunker), `getCacheStats` and `clearCache` (chunkCache), `sendStatusMessage` (geminiExecutor). `changeModeParser` used `console.warn` instead of `Logger`. `chunkChangeModeEdits` returned a misleading single-element array for empty input. `chunkCache.getChunks` had no runtime validation after `JSON.parse`. `changeModeTranslator` used CLI-style syntax for fetch-chunk instructions.
- **Decision:** Delete all dead exports. Replace `console.warn` with `Logger.warn`. Return `[]` for empty edits. Add shape validation in `getChunks`. Replace CLI-style instructions with bullet-point MCP tool format. Remove `async` from `processChangeModeOutput`. Remove unused `totalChunks` param from `createChunk`. Truncate raw output in error messages to 2000 chars.
- **Consequences:** Cleaner API surface. Consistent logging. Safer cache deserialization. More accurate instructions for Claude when fetching subsequent chunks.

## ADR-010: Configure Biome for Linting and Formatting
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The project had no linter or formatter — only `tsc --noEmit` for type checking. Code style was inconsistent (mixed single/double quotes across files). CLAUDE.md requires explicit type imports (`import type { ... }`), but this was not enforced by tooling. ESLint + Prettier is the traditional combo but requires extensive configuration and plugin management. Biome is a single tool that handles both linting and formatting with fast native performance.
- **Decision:** Add Biome v2.4.4 as a dev dependency. Configure with: 2-space indent, 120 line width, double quotes, semicolons always, trailing commas all. Enable recommended lint rules plus `useImportType: "error"`. Suppress `noStaticOnlyClass` (refactoring Logger to plain functions is deferred). Scope to `src/**` only (skip docs, dist, scripts). Update `lint` script to run `biome check` before `tsc --noEmit`.
- **Consequences:** Consistent code style enforced automatically. Type import violations caught at lint time. Single fast tool instead of ESLint + Prettier + plugins. All 14 source files normalized in initial formatting pass. Minor code fixes applied: `node:` protocol for builtins, template literals over concatenation, typed regex match variables.

## ADR-011: Update Default Models to Gemini 3.1 Pro / 3 Flash
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The project defaulted to `gemini-2.5-pro` with `gemini-2.5-flash` as the quota fallback. Google has released Gemini 3.1 Pro (`gemini-3.1-pro-preview`) as the latest Pro model and Gemini 3 Flash (`gemini-3-flash-preview`) as the latest Flash model. No 3.1 Flash exists yet. The upstream community requested this update (PR #54, Issue #51). Additionally, the quota fallback logic matched a hardcoded model-specific string (`"Quota exceeded for quota metric 'Gemini 2.5 Pro Requests'"`) which would fail to trigger for any other model generation.
- **Decision:** Update `MODELS.PRO` to `gemini-3.1-pro-preview` and `MODELS.FLASH` to `gemini-3-flash-preview`. Fix quota detection to match on `RESOURCE_EXHAUSTED` (the generic gRPC status code) instead of a model-specific quota metric string, so fallback works regardless of which model the user ran. Remove model generation names from status messages (e.g., "Gemini Pro quota exceeded" instead of "Gemini 3 Pro quota exceeded") so they stay accurate as models evolve.
- **Consequences:** Users get the latest Gemini models by default. Quota fallback now works for any model generation (2.5, 3.0, 3.1, etc.). Users on older CLI versions who explicitly pass `gemini-2.5-pro` or `gemini-3-pro-preview` still get Flash fallback on quota errors.

## ADR-012: Rename Project to `ask-gemini-mcp`
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The npm package was named `claude-ask-gemini-mcp` and the GitHub repo was `Lykhoyda/claude-ask-gemini-mcp`. The "claude-" prefix is misleading — the tool works with any MCP client (Warp, Copilot, Cursor, etc.), not just Claude. The shorter name `ask-gemini-mcp` was available on npm and better describes what the tool does: ask Gemini via MCP.
- **Decision:** Rename the npm package to `ask-gemini-mcp` and the GitHub repo to `Lykhoyda/ask-gemini-mcp`. Update all references in package.json, README, docs, deploy scripts, and VitePress config. Keep the `gemini-mcp` CLI binary name unchanged (short and works well). Preserve historical references to old names in CHANGELOG and prior ADRs.
- **Consequences:** Users installing via `npx -y ask-gemini-mcp` get the correct package. The old `claude-ask-gemini-mcp` name will no longer resolve on npm. GitHub will auto-redirect the old repo URL. Documentation and badges all point to the new name.

## ADR-013: Raise Minimum Node.js to 20 (LTS Only)
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** Node.js 18 reached End-of-Life in April 2025. The project previously required >=18.0.0. Active LTS versions are Node.js 20 (LTS until April 2026) and Node.js 22 (LTS until April 2027). Supporting EOL runtimes increases maintenance burden and security risk with no benefit — users on Node 18 are already past its support window.
- **Decision:** Raise `engines.node` to `>=20.0.0`. Update CI matrix to test only Node 20 and 22 (drop 18). Update all documentation references. Adopt an LTS-only policy going forward.
- **Consequences:** Users on Node.js 18 will see an engine compatibility warning from npm. CI runs faster with fewer matrix entries. The project stays on supported, security-patched runtimes.

## ADR-016: Publish to MCP Registry with Automated GitHub Actions Release
- **Date:** 2026-02-24
- **Status:** Accepted
- **Context:** The official MCP Registry (registry.modelcontextprotocol.io) launched in preview September 2025 as the standard discovery mechanism for MCP servers. Publishing requires a `server.json` metadata file, a `mcpName` field in `package.json`, and authentication via the `mcp-publisher` CLI. The registry supports GitHub OIDC for zero-secret CI authentication.
- **Decision:** Add `mcpName: "io.github.Lykhoyda/ask-gemini"` to `package.json`. Create `server.json` with server metadata, npm package reference, and environment variable declarations. Create `.github/workflows/release.yml` triggered on `v*` tags that: runs lint/test/build, publishes to npm, then authenticates via GitHub OIDC and publishes to the MCP Registry. The workflow auto-syncs the git tag version into `server.json` so versions stay consistent. Add `.mcpregistry_*` to `.gitignore` for local token files created by `mcp-publisher login`.
- **Consequences:** Tagging a release (`git tag v1.2.1 && git push origin v1.2.1`) triggers a single workflow that publishes to both npm and the MCP Registry. No MCP-specific secrets needed — OIDC handles auth. The server becomes discoverable via the registry API and MCP-aware clients.

## ADR-015: Revert to `-p` Flag for Gemini CLI v0.29+
- **Date:** 2026-02-24
- **Status:** Accepted (supersedes ADR-006)
- **Context:** Gemini CLI v0.29.5 changed behavior again. The `--` separator (positional argument) now launches **interactive mode**, which expects stdin input. Since our MCP server spawns Gemini with `stdio: ["ignore", ...]`, stdin is closed, causing exit code 42: "No input provided via stdin." The `-p`/`--prompt` flag deprecation from v0.23 has been reversed — `-p` is now the correct way to trigger **non-interactive (headless) mode**.
- **Decision:** Revert `CLI.FLAGS.SEPARATOR = "--"` back to `CLI.FLAGS.PROMPT = "-p"` in `src/constants.ts`. Update both main and fallback code paths in `geminiExecutor.ts` to use `CLI.FLAGS.PROMPT`. This undoes ADR-006's change while keeping all other improvements from that audit (removed broken `@` quoting, etc.).
- **Consequences:** Fixes exit code 42 errors for users on Gemini CLI v0.29+. Users on older CLI versions (v0.23–v0.28) that still reject `-p` may need to upgrade their Gemini CLI. The `-p` flag is the officially supported non-interactive invocation method going forward.

## ADR-014: Add Vitest Test Suite
- **Date:** 2026-02-23
- **Status:** Accepted
- **Context:** The project had zero test infrastructure — no test runner, no test files, and a placeholder `npm test` script. The codebase has several pure utility modules (changeModeParser, changeModeChunker, changeModeTranslator) ideal for unit testing without mocking. The project is native ESM (`"type": "module"`, `"module": "Node16"`), which makes Jest painful (requires `--experimental-vm-modules` workarounds).
- **Decision:** Use Vitest as the test runner — it handles ESM natively and `tsx` is already a devDependency. Start with pure-function unit tests (no mocking) for the three changeMode utilities, registry tests using lightweight stub tools, and a smoke test verifying tool registration. Defer mocking-heavy tests (commandExecutor, chunkCache, geminiExecutor) and E2E tests to future iterations.
- **Consequences:** 42 tests across 5 test files provide baseline coverage for the most logic-dense modules. `npm test` now runs `vitest run` instead of a no-op. Test infrastructure is in place for incremental coverage expansion.

## ADR-018: Claude Code Plugin — Hybrid Multi-Entrypoint Architecture
- **Date:** 2026-02-25
- **Status:** Accepted (implemented in ADR-027)
- **Context:** We want a Claude Code plugin for automated Gemini code reviews (pre-commit hook, Stop hook, on-demand skill, isolated subagent). The core question was whether to reuse code from the existing MCP server. Hooks run as shell commands and have no MCP client, so they can't call MCP tools directly.
- **Decision:** Hybrid multi-entrypoint approach. Add a second CLI binary `ask-gemini-run` (`src/run.ts`) that calls `executeGeminiCLI()` directly and prints to stdout. The plugin uses MCP tools for AI-context interactions (subagent, skill) and the direct CLI for shell-context interactions (hooks). Both entry points share the same core logic (`geminiExecutor.ts`). No monorepo needed — just two `bin` entries in `package.json`. Rejected: MCP-only (hooks can't use MCP), Bash-only (duplicates hardened logic), monorepo (overkill).
- **Consequences:** Zero logic duplication. Hooks get the same model fallback, quota handling, and chunking as the MCP server. Plugin is mostly markdown/config (~3 files). The `ask-gemini-run` binary also serves as a standalone CLI for users who want Gemini access without MCP.
- **Design doc:** [docs/plans/2026-02-25-claude-code-plugin-design.md](plans/2026-02-25-claude-code-plugin-design.md)

## ADR-019: Structured JSON Output via --output-format json
- **Date:** 2026-02-25
- **Status:** Accepted
- **Context:** The Gemini CLI supports `--output-format json` which returns `{ response, stats, error }` instead of raw text. Our MCP server was parsing raw text output, losing token usage stats and getting unstructured error messages. Since we always invoke the CLI programmatically, structured JSON is strictly better.
- **Decision:** Always pass `--output-format json` to the Gemini CLI. Parse JSON in `geminiExecutor.ts`, extract the `response` text, and append a one-line stats summary (input/output tokens, model). Fall back to raw text if JSON parsing fails (backward compat with older CLI versions). No schema changes — the improvement is transparent to MCP clients.
- **Consequences:** Users get token usage visibility. Errors are structured and more informative. Older Gemini CLI versions that don't support `--output-format` degrade gracefully to the current behavior.
- **Follow-up (2026-02-25):** Added `extractJson()` to handle CLI warning/debug lines before JSON object, and improved error handling for error responses that have only a code (no message).
- **Design doc:** [docs/plans/2026-02-25-structured-json-output-design.md](plans/2026-02-25-structured-json-output-design.md)

## ADR-017: Smithery CJS Compatibility — createSandboxServer Export
- **Date:** 2026-02-24
- **Status:** Accepted
- **Context:** Smithery bundles MCP servers with esbuild in CJS mode for capability scanning. Our ESM code uses `createRequire(import.meta.url)` to read `package.json` at runtime, but in CJS bundles `import.meta` is empty (undefined), causing the module to crash on load. This prevented Smithery from scanning tool/prompt schemas.
- **Decision:** (1) Wrap `createRequire(import.meta.url)` in a try/catch with hardcoded fallback values (`name: "ask-gemini-mcp"`, `version: "0.0.0"`). (2) Export a `createSandboxServer()` function that returns a configured `McpServer` with tools/prompts registered via stub handlers — Smithery's recommended pattern for servers that need special handling during scanning. (3) Separate CLI entry point (`src/cli.ts`) from library module (`src/index.ts`) — `index.ts` no longer auto-executes `main()`, preventing stdio conflicts when Smithery imports the module. `package.json` `bin` now points to `dist/cli.js`.
- **Consequences:** The module loads cleanly in both ESM (normal operation) and CJS (Smithery bundling) contexts. Smithery can scan tool schemas without invoking real Gemini CLI or triggering stdio transport. The fallback version "0.0.0" is only used in CJS bundles, not in production stdio operation.
