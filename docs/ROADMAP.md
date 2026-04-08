# Roadmap

## ~~Priority 2: Claude Code Plugin~~ ALL DONE
- See [design doc](plans/2026-02-25-claude-code-plugin-design.md)

## Priority 4: Features from Community PRs
- [x] LRU response caching — in-memory LRU with 30min TTL, 10MB max, provider+prompt+model key (upstream PR #44)
- [x] Gemini API compatibility mode (upstream PR #35) — simplified `ask-gemini` to 2 params (prompt + model), moved changeMode to dedicated `ask-gemini-edit` tool (ADR-034)

## Priority 6: Documentation Site Redesign (ADR-036)
- [x] **Dark-only theme** — `appearance: 'force-dark'`, indigo accent (#818CF8), Geist Sans/Mono fonts
- [x] **Design token system** — `design-tokens.css` with brand, surface, text, spacing tokens + VitePress remaps
- [x] **Anti-grid card corners** — CSS `clip-path` with layered pseudo-element border technique
- [x] **Component rebuilds** — SetupTabs, DiagramModal, TroubleshootingModal restyled with tokens
- [x] **Multi-provider navigation** — Providers dropdown, sidebar section, 4 provider pages
- [x] **Provider cards** — Per-provider accent colors with gradient-glow hover effects
- [x] **Rebrand** — "Ask LLM" title, multi-provider hero, updated tagline
- [x] Convert config.js / theme/index.js to TypeScript
- [x] Add provider installation commands to SetupTabs per provider page

## Priority 7: Distribution & Discovery
- [x] Add OpenGraph metadata and badges to README for better link previews
- [ ] Publish blog post / dev.to article about the tool and AI-to-AI collaboration pattern
- [ ] Add to MCP client directories (Cursor, Windsurf, Cline marketplace listings)

## Priority 8: Multi-LLM Support (ask-llm-mcp) — ADR-020, ADR-026
- [x] **Phase 1: Monorepo restructure** — yarn workspaces, packages/shared + packages/gemini-mcp + packages/plugin (ADR-026)
- [x] **Phase 2: Plugin providers** — Gemini + Codex in packages/claude-plugin: ask-codex-run binary, codex-reviewer agent, /codex-review skill (ADR-031)
- [x] **Phase 3: Codex MCP** — packages/codex-mcp/ (`ask-codex-mcp`), codexExecutor with JSONL parsing, gpt-5.4 default with gpt-5.4-mini fallback on quota errors (ADR-028)
- [x] **Phase 4: Orchestrator** — packages/llm-mcp/ (`ask-llm-mcp`), dynamic provider import via `./register` subpath, `isCommandAvailable()` gating, tool dedup, startup logging (ADR-029)
- [x] **Phase 5: Ollama** — packages/ollama-mcp/ (`ask-ollama-mcp`), HTTP executor via native fetch against POST /api/chat, qwen2.5-coder:7b default with 1.5b fallback, OLLAMA_HOST env var, /api/tags availability probe (ADR-032)
- [x] **Local smoke tests** — Husky pre-push hook runs integration tests using locally installed CLIs (ADR-043). Replaced weekly GA workflow with per-push local testing via `scripts/smoke-test.sh`
- [x] **Benchmark** — token overhead + latency comparison of MCP vs Skill vs Subagent vs Orchestrator (ADR-030, static analysis complete, manual runs pending)
- See [design doc](plans/2026-02-26-ask-llm-mcp-design.md)

## Priority 9: Bug Fixes (GitHub Issues)
- [x] **#21 Gemini fallback** — Multi-pattern quota detection for newer CLI versions (ADR-044)
- [x] **#20 Claude Desktop timeout** — Lowered default timeout to 210s, actionable error messages (ADR-045)
- [x] **ANT-242 Codex hangs + Node detection** — Added `--full-auto` flag, Node.js v20+ startup check (ADR-046)

## Undecided / Potential Improvements
- **Streaming JSON output** — expose `--output-format stream-json` for real-time JSONL progress events (`init`, `message`, `tool_use`, `result`). Would replace keepalive messages with live content streaming. High complexity, no user demand yet.
- **Extract tool registration loop** — the for-of loop registering tools/prompts from `toolRegistry` is identical across gemini/codex/ollama servers. Could be a shared `registerTools(server, registry)` helper, but llm-mcp has a different pattern so the dedup gain is modest.

## Completed

### Plugin Marketplace & Refinement (ADR-038/039/040/041)
- [x] **Marketplace distribution** — `.claude-plugin/marketplace.json` at repo root, `git-subdir` source, `/plugin marketplace add Lykhoyda/ask-llm` (ADR-038)
- [x] **Plugin rename** — `ask-gemini` → `ask-llm`, multi-provider description and keywords
- [x] **Agent colors** — cyan (Gemini), green (Codex), yellow (Ollama), magenta (brainstorm)
- [x] **Hooks → gemini CLI** — replaced `node dist/run.js` with `gemini -p @tempfile`, no build dependency
- [x] **Hook temp file cleanup** — `trap 'rm -f "$tmp"' EXIT HUP INT TERM` (ADR-040)
- [x] **MCP server names** — shortened from `gemini-cli`/`codex-cli` to `gemini`/`codex`, then moved to user-scope to avoid `plugin:` prefix
- [x] **/multi-review skill** — parallel Gemini + Codex code review with consensus highlighting
- [x] **Concurrency fix** — module-level progress state → `ProgressHandle` closure pattern in all 4 servers (ADR-039)
- [x] **Async stop()** — `ProgressHandle.stop()` now awaits final progress notification (ADR-040)
- [x] **Shared progress tracker** — extracted `createProgressTracker` into `@ask-llm/shared`, −180 lines (ADR-041)
- [x] **Package cleanup** — `bin` object form, `prompt_processed` → `promptProcessed`, ollama-mcp tsconfig ref
- [x] **Version bump** — all packages bumped to next minor (gemini 1.5.0, others 0.2.0)

### Priority 1: Critical Fixes (all resolved)
- [x] Fix deprecated `-p` flag for Gemini CLI v0.23+ (upstream PRs #56, #43)
- [x] Fix exit code 42 on Gemini CLI v0.29.5+: revert to `-p` flag for non-interactive mode (ADR-015)
- [x] Windows compatibility: ENOENT spawn errors, `.cmd` handling (upstream PRs #23, #27, #41, #43)
- [x] Add process timeout to prevent indefinite hangs (5min default, `GMCPT_TIMEOUT_MS` env var)
- [x] Fix all utils/ audit issues (logger, commandExecutor, geminiExecutor, parsers, cache)

### Priority 3: Gemini CLI Parameter Expansion (all resolved)
- [x] **Structured JSON output** — pass `--output-format json` (ADR-019)
- [x] **Multi-turn session support** — expose `--resume <sessionId>` (ADR-021)
- [x] **Include additional directories** — expose `--include-directories <dirs>` (ADR-022)
- [x] **Expose thinking tokens in stats** — display thinking token count in stats footer

### Priority 4: Features from Community PRs (partial)
- [x] MCP tool annotations per spec (upstream PR #46) (ADR-023)
- [x] Update default model to `gemini-3.1-pro-preview` (upstream PR #54)

### Priority 5: Open Issues (all resolved)
- [x] ~~Allow model configuration via MCP JSON settings~~ (upstream Issue #49) — Won't fix: per-call `model` param already exists; Gemini CLI picks its own default
- [x] ~~Fix excessive token responses for small prompts~~ (upstream Issues #6, #26) — Won't fix: root cause was `gemini-2.5-pro` model bug (always returned ~45k tokens); mitigated by changing default to `gemini-3.1-pro-preview`. Gemini CLI has no `--max-output-tokens` flag.
- [x] Add automated test suite (Vitest, 99 tests across 6 files, ADR-014)
- [x] Set up linter and formatter (Biome v2.4.4)

### Priority 6: Project Structure & Docs (all resolved)
- [x] Move deployable VitePress docs to `apps/docs/`
- [x] Keep `docs/` for internal project docs only (ROADMAP, DECISIONS, BUGS, plans/)
- [x] Update VitePress config, build scripts, and deploy workflow for new path
- [x] Remove public roadmap page from VitePress site
- [x] Redesign homepage: replace feature grid with tabbed SetupTabs installation component
- [x] Fix light theme readability: use `html:not(.dark)` selectors
- [x] Add orange syntax highlighting for JSON strings in light mode code blocks
- [x] Remove unused components (ClientGrid, CodeBlock, ConfigModal, ad/funding components)
- [x] Apply Prettier formatting to all docs Vue/CSS/JS files

### Priority 7: Distribution & Discovery (partial)
- [x] Publish to official MCP Registry via `mcp-publisher` (ADR-016)
- [x] Automated release workflow: `git tag v* && git push` → npm + MCP Registry (ADR-016)
- [x] ~~Smithery~~ (requires paid plan for stdio servers — skipped)
- [x] Add GitHub Release with changelog in release workflow
- [x] Improve npm discoverability: added keywords
- [x] Document global (user-scope) install option in README
- [x] Submit to awesome-mcp-servers list (PR [#2581](https://github.com/punkpeye/awesome-mcp-servers/pull/2581))
- [x] Submit to mcp.so and mcpservers.org directories

### CI & Workflow Hardening
- [x] Update all GitHub Actions to latest versions (checkout@v6, setup-node@v6, upload-pages-artifact@v4)
- [x] Add lint step to CI pipeline, remove `continue-on-error` on tests
- [x] Use `pull_request_target` for Claude auto-review to support fork PRs (ADR-025)
- [x] Fix Claude workflow permissions (`contents: write`, `pull-requests: write`, `additional_permissions`)
- [x] Add `labeled` trigger for `@claude` mentions on issue label events

### Priority 2: Claude Code Plugin (all resolved)
- [x] Add direct CLI binary `ask-gemini-run` (`src/run.ts`) — calls geminiExecutor directly, supports stdin piping
- [x] Create subagent `gemini-reviewer.md` — isolated Gemini review in separate context
- [x] Create `/gemini-review` skill — on-demand Gemini consultation via agent delegation
- [x] Add Stop hook — background Gemini review of session changes
- [x] Add pre-commit hook — PreToolUse hook on Bash, reviews staged diff via Gemini before `git commit`
- [x] Bundle as Claude Code plugin (`plugin.json`, `.mcp.json`, agents, skills, hooks)
- [x] Add subpath export `ask-gemini-mcp/executor` for direct executor access (ADR-027)

### Other Completed
- [x] Remove non-core tools (`brainstorm`, `help`, `timeout-test`) per ADR-004
- [x] Transfer ownership: update all references from `jamubc/gemini-mcp-tool` to `Lykhoyda/ask-gemini-mcp`
- [x] Rewrite README.md with updated value proposition and accurate tool list
- [x] Remove previous owner sponsorship/funding content from docs
- [x] Update LICENSE copyright
- [x] Remove unused dependencies (`ai`, `chalk`, `d3-shape`, `inquirer`, `archiver`)
- [x] Delete dead code (empty `timeoutManager.ts`, missing `contribute.ts` script)
- [x] Clean up orphaned funding Vue components
- [x] Fix stale docs (commands.md, sandbox.md, getting-started.md)
- [x] Upgrade `@modelcontextprotocol/sdk` from 0.5.0 to ^1.27.0
- [x] Raise minimum Node.js to 20 (LTS only), update CI matrix to test 20, 22
- [x] Clean orphaned dist/ files from deleted sources
- [x] Rename project from `claude-ask-gemini-mcp` to `ask-gemini-mcp` (ADR-012)
- [x] MCP Registry publishing: `server.json`, `mcpName` in package.json (ADR-016)
- [x] Fix stale server name/version in `src/index.ts` — now reads from `package.json` at runtime
- [x] Fix Smithery CJS bundling: `createSandboxServer()` export, separate CLI entry point (ADR-017)
- [x] Fix `npx` bin resolution: renamed bin from `gemini-mcp` to `ask-gemini-mcp` to match package name
- [x] Prevent AI clients from using outdated models: updated tool/param descriptions
- [x] Expose thinking tokens in `formatStats` stats footer
- [x] Fix `extractJson` greedy first-match bug — now prefers Gemini-shaped JSON
- [x] Fix `extractJson` escape-outside-string bug — backslash escapes only inside JSON strings
