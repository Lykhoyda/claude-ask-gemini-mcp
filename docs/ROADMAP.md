# Roadmap

## Priority 1: Critical Fixes
- [x] Fix deprecated `-p` flag for Gemini CLI v0.23+ (upstream PRs #56, #43)
- [x] Fix exit code 42 on Gemini CLI v0.29.5+: revert to `-p` flag for non-interactive mode (ADR-015)
- [x] Windows compatibility: ENOENT spawn errors, `.cmd` handling (upstream PRs #23, #27, #41, #43)
- [x] Add process timeout to prevent indefinite hangs (5min default, `GMCPT_TIMEOUT_MS` env var)
- [x] Fix all utils/ audit issues (logger, commandExecutor, geminiExecutor, parsers, cache)

## Priority 2: Claude Code Plugin
- [ ] Add direct CLI binary `ask-gemini-run` (`src/run.ts`) — calls geminiExecutor directly, supports stdin piping
- [ ] Create subagent `gemini-reviewer.md` — isolated Gemini review in separate context
- [ ] Create `/gemini-review` skill — on-demand Gemini consultation
- [ ] Add pre-commit hook — background Gemini review of staged diff
- [ ] Add Stop hook — background Gemini review of session changes
- [ ] Bundle as Claude Code plugin (`plugin.json`)
- See [design doc](plans/2026-02-25-claude-code-plugin-design.md)

## Priority 3: Gemini CLI Parameter Expansion
As a user, I want the MCP server to expose more Gemini CLI capabilities so I get richer responses, multi-turn conversations, and better workspace context.

- [x] **Structured JSON output** — pass `--output-format json` to get `{ response, stats, error }` back from Gemini instead of raw text. Gives token usage stats, structured errors, and cleaner response parsing (ADR-019)
- [x] **Multi-turn session support** — expose `--resume <sessionId>` via a new `sessionId` parameter. Return the session ID in responses so Claude can continue conversations with Gemini across multiple tool calls (ADR-021)
- [x] **Include additional directories** — expose `--include-directories <dirs>` via a new `includeDirs` string array parameter. Lets users point Gemini at code outside the CWD (monorepo support) (ADR-022)
- [x] **Expose thinking tokens in stats** — display Gemini thinking token count in the stats footer between output tokens and cached count

## Priority 4: Features from Community PRs
- [x] MCP tool annotations per spec (upstream PR #46) (ADR-023)
- [ ] LRU response caching with performance optimizations (upstream PR #44)
- [ ] Gemini API compatibility mode (upstream PR #35)
- [x] Update default model to `gemini-3.1-pro-preview` (upstream PR #54)

## Priority 5: Open Issues
- [ ] Allow model configuration via MCP JSON settings (upstream Issue #49)
- [ ] Fix excessive token responses for small prompts (upstream Issues #6, #26)
- [x] Add automated test suite (Vitest, 88 tests across 6 files, ADR-014)
- [x] Set up linter and formatter (Biome v2.4.4)

## Priority 6: Project Structure & Docs
- [x] Move deployable VitePress docs to `apps/docs/` (index.md, getting-started.md, concepts/, usage/, .vitepress/, public/)
- [x] Keep `docs/` for internal project docs only (ROADMAP, DECISIONS, BUGS, plans/)
- [x] Update VitePress config, build scripts, and deploy workflow for new path
- [x] Remove public roadmap page from VitePress site (unnecessary duplication of internal roadmap)
- [x] Redesign homepage: replace feature grid with tabbed SetupTabs installation component
- [x] Fix light theme readability: use `html:not(.dark)` selectors (VitePress has no `html.light` class)
- [x] Add orange syntax highlighting for JSON strings in light mode code blocks
- [x] Remove unused components (ClientGrid, CodeBlock, ConfigModal, ad/funding components)
- [x] Apply Prettier formatting to all docs Vue/CSS/JS files

## Priority 7: Distribution & Discovery
- [x] Publish to official MCP Registry via `mcp-publisher` (ADR-016)
- [x] Automated release workflow: `git tag v* && git push` → npm + MCP Registry (ADR-016)
- [ ] ~~Smithery~~ (requires paid plan for stdio servers — skipped)
- [x] Add GitHub Release with changelog (`gh release create --generate-notes` in release workflow)
- [ ] Submit to awesome-mcp-servers list
- [ ] Submit to mcp.so and mcpservers.org directories
- [x] Improve npm discoverability: added keywords (`mcp-server`, `gemini-cli`, `google-gemini`, `claude`, `ai-collaboration`, `code-review`, `second-opinion`)
- [ ] Add OpenGraph metadata and badges to README for better link previews
- [ ] Publish blog post / dev.to article about the tool and AI-to-AI collaboration pattern
- [ ] Add to MCP client directories (Cursor, Windsurf, Cline marketplace listings)
- [x] Document global (user-scope) install option in README: `claude mcp add --scope user gemini-cli -- npx -y ask-gemini-mcp`

## Priority 8: Multi-LLM Support (ask-llm-mcp) — ADR-020
Deferred until Gemini CLI improvements (Priority 3) are complete.

- [ ] **Phase 1: Monorepo restructure** — yarn workspaces, move src/ → packages/ask-gemini/, extract shared code → packages/shared/
- [ ] **Phase 2: Codex provider** — packages/ask-codex/, codexExecutor with quiet mode, default to latest model
- [ ] **Phase 3: Orchestrator** — packages/ask-llm/, imports all provider tools, isAvailable() gating, publish ask-llm-mcp
- [ ] **Phase 4: Ollama (v2)** — packages/ask-ollama/, HTTP executor, Docker integration tests
- [ ] **Cloud smoke tests** — nightly CI with API keys as secrets, one real call per provider
- See [design doc](plans/2026-02-26-ask-llm-mcp-design.md)

## Completed
- [x] Remove non-core tools (`brainstorm`, `help`, `timeout-test`) per ADR-004
- [x] Transfer ownership: update all references from `jamubc/gemini-mcp-tool` to `Lykhoyda/ask-gemini-mcp`
- [x] Rewrite README.md with updated value proposition and accurate tool list
- [x] Remove previous owner sponsorship/funding content from docs
- [x] Update LICENSE copyright
- [x] Remove unused dependencies (`ai`, `chalk`, `d3-shape`, `inquirer`, `archiver`)
- [x] Delete dead code (empty `timeoutManager.ts`, missing `contribute.ts` script)
- [x] Clean up orphaned funding Vue components
- [x] Fix stale docs (commands.md, sandbox.md, getting-started.md)
- [x] Upgrade `@modelcontextprotocol/sdk` from 0.5.0 to ^1.26.0
- [x] Raise minimum Node.js to 20 (LTS only), update CI matrix to test 20, 22
- [x] Clean orphaned dist/ files from deleted sources
- [x] Fix deprecated `-p` flag → `--` separator + positional prompt (ADR-006)
- [x] Revert `--` separator back to `-p` flag for Gemini CLI v0.29.5+ (ADR-015)
- [x] Windows spawn compat (`shell: true` on win32)
- [x] Process timeout (5min default + SIGTERM/SIGKILL)
- [x] Fix O(n^2) stdout concatenation → Buffer array
- [x] Logger rewrite: level filtering, fix all inconsistencies, remove dead `log()` method
- [x] Remove broken `@` quoting, dead exports, sendStatusMessage placeholder
- [x] Add cache shape validation, truncate error output, fix changeModeTranslator text
- [x] Rename project from `claude-ask-gemini-mcp` to `ask-gemini-mcp` (ADR-012)
- [x] MCP Registry publishing: `server.json`, `mcpName` in package.json, automated release workflow (ADR-016)
- [x] Fix stale server name/version in `src/index.ts` — now reads from `package.json` at runtime
- [x] Upgrade `@modelcontextprotocol/sdk` from ^1.26.0 to ^1.27.0
- [x] Update CLAUDE.md: fix stale test/lint descriptions, update architecture section
- [x] Fix Smithery CJS bundling: `createRequire(import.meta.url)` crash, add `createSandboxServer()` export, separate CLI entry point (ADR-017)
- [x] Fix `npx` bin resolution: renamed bin from `gemini-mcp` to `ask-gemini-mcp` to match package name
- [x] Prevent AI clients from using outdated models: updated tool/param descriptions to discourage model override
- [x] Expose thinking tokens in `formatStats` stats footer
- [x] Fix `extractJson` greedy first-match bug — now prefers Gemini-shaped JSON (`response`/`error` fields)
- [x] Fix `extractJson` escape-outside-string bug — backslash escapes now only tracked inside JSON strings

## Undecided / Potential Improvements
- **Streaming JSON output** — expose `--output-format stream-json` for real-time JSONL progress events (`init`, `message`, `tool_use`, `result`). Would replace keepalive messages with live content streaming. High complexity, no user demand yet.
