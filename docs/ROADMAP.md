# Roadmap

## Priority 1: Critical Fixes
- [x] Fix deprecated `-p` flag for Gemini CLI v0.23+ (upstream PRs #56, #43)
- [x] Fix exit code 42 on Gemini CLI v0.29.5+: revert to `-p` flag for non-interactive mode (ADR-015)
- [x] Windows compatibility: ENOENT spawn errors, `.cmd` handling (upstream PRs #23, #27, #41, #43)
- [x] Add process timeout to prevent indefinite hangs (5min default, `GMCPT_TIMEOUT_MS` env var)
- [x] Fix all utils/ audit issues (logger, commandExecutor, geminiExecutor, parsers, cache)

## Priority 2: Features from Community PRs
- [ ] Multi-turn session support via session IDs (upstream PR #50)
- [ ] MCP tool annotations per spec (upstream PR #46)
- [ ] LRU response caching with performance optimizations (upstream PR #44)
- [ ] Gemini API compatibility mode (upstream PR #35)
- [x] Update default model to `gemini-3.1-pro-preview` (upstream PR #54)

## Priority 3: Open Issues
- [ ] Allow model configuration via MCP JSON settings (upstream Issue #49)
- [ ] Fix excessive token responses for small prompts (upstream Issues #6, #26)
- [x] Add automated test suite (Vitest, 58 tests across 6 files, ADR-014)
- [x] Set up linter and formatter (Biome v2.4.4)

## Priority 4: Distribution
- [x] Publish to official MCP Registry via `mcp-publisher` (ADR-016)
- [x] Automated release workflow: `git tag v* && git push` → npm + MCP Registry (ADR-016)
- [ ] ~~Smithery~~ (requires paid plan for stdio servers — skipped)
- [ ] Add GitHub Release with changelog (gh release create)
- [ ] Submit to awesome-mcp-servers list
- [ ] Submit to mcp.so and mcpservers.org directories

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
