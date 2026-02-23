# Roadmap

## Priority 1: Critical Fixes
- [x] Fix deprecated `-p` flag for Gemini CLI v0.23+ (upstream PRs #56, #43)
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
- [x] Add automated test suite (Vitest, 42 tests, ADR-014)
- [x] Set up linter and formatter (Biome v2.4.4)

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
- [x] Fix deprecated `-p` flag → `--` separator + positional prompt
- [x] Windows spawn compat (`shell: true` on win32)
- [x] Process timeout (5min default + SIGTERM/SIGKILL)
- [x] Fix O(n^2) stdout concatenation → Buffer array
- [x] Logger rewrite: level filtering, fix all inconsistencies, remove dead `log()` method
- [x] Remove broken `@` quoting, dead exports, sendStatusMessage placeholder
- [x] Add cache shape validation, truncate error output, fix changeModeTranslator text
- [x] Rename project from `claude-ask-gemini-mcp` to `ask-gemini-mcp` (ADR-012)
