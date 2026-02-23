# Changelog

## [Unreleased]

### Changed
- Transferred ownership from `jamubc/gemini-mcp-tool` to `Lykhoyda/claude-ask-gemini-mcp`
- Rewrote README.md to reflect new repo identity and primary use cases
- Updated all documentation links to point to the new repository
- Removed previous owner sponsorship and funding content
- Updated LICENSE copyright to Lykhoyda
- Upgraded `@modelcontextprotocol/sdk` from 0.5.0 to ^1.26.0
- Upgraded `@types/node` from ^20.0.0 to ^22.0.0
- Raised minimum Node.js version from 16 to 18 (Node 16 is EOL)
- Updated CI matrix to test Node 18, 20, 22 (dropped Node 16)

### Fixed (utils/ audit)
- **Critical:** Replaced deprecated `-p` CLI flag with `--` separator + positional prompt (Gemini CLI v0.23+)
- **High:** Added configurable process timeout (5min default, `GMCPT_TIMEOUT_MS` env var) with SIGTERM→SIGKILL
- **High:** Added Windows compatibility (`shell: true` on win32) in `commandExecutor.ts`
- **Medium:** Fixed O(n^2) string concatenation in stdout capture — now uses `Buffer[]` + `Buffer.concat()`
- **Medium:** Removed broken `@` symbol quoting logic in `geminiExecutor.ts` (unnecessary with `shell: false`)
- **Medium:** Truncated raw Gemini output in error messages to 2000 chars
- **Low:** Added log level filtering via `GMCPT_LOG_LEVEL` env var (debug/info/warn/error, default: warn)
- **Low:** Fixed `Logger.toolInvocation` to include tool name; `toolParsedArgs` to include model/sandbox
- **Low:** Fixed `Logger.formatMessage` trailing `\n` causing double-newlines
- **Low:** Replaced `console.warn` with `Logger.warn` in `changeModeParser.ts`
- **Low:** Fixed `chunkChangeModeEdits` returning misleading single-element array for empty input
- **Low:** Added runtime shape validation after `JSON.parse` in `chunkCache.getChunks`
- **Low:** Replaced CLI-style `fetch-chunk` instructions with MCP tool description format
- **Low:** Removed `async` from `processChangeModeOutput` (no await calls)
- Removed dead code: `Logger.log()`, `summarizeChunking`, `getCacheStats`, `clearCache`, `sendStatusMessage`
- Replaced `Logger._commandStartTimes` Map keyed by `Date.now()` with incrementing counter to avoid key collisions

### Added
- Updated default models to `gemini-3.1-pro-preview` (Pro) and `gemini-3-flash-preview` (Flash)
- Fixed quota fallback to match on `RESOURCE_EXHAUSTED` instead of model-specific string (works for any model generation)
- Configured Biome v2.4.4 for linting and formatting (`biome.json`)
- Added npm scripts: `format`, `format:check`, `check` (Biome) alongside existing `lint` (now Biome + tsc)
- Enforced `useImportType` rule to ensure explicit type imports per project convention
- Normalized all source files: double quotes, trailing commas, 2-space indent, 120 line width
- Added `node:` protocol to Node.js builtin imports
- Replaced `while ((match = regex.exec(...)))` patterns with explicit reassignment to satisfy `noAssignInExpressions`
- Fixed `noExplicitAny` in `fetch-chunk.tool.ts` by using Zod schema inference

### Removed
- Removed non-core tools: `brainstorm`, `help`, `timeout-test` (ADR-004). Server now exposes only `ask-gemini`, `fetch-chunk`, and `ping`
- Deleted orphaned tool source files (`brainstorm.tool.ts`, `timeout-test.tool.ts`, `test-tool.example.ts`)
- Removed dead brainstorm-related properties from `ToolArguments` interface
- Removed unused dependencies: `ai`, `chalk`, `d3-shape`, `inquirer`, `archiver`, `@types/inquirer`
- Moved `prismjs` from dependencies to devDependencies (only used in docs)
- Deleted empty `src/utils/timeoutManager.ts`
- Removed dead `contribute` npm script (referenced non-existent `src/contribute.ts`)
- Deleted orphaned funding page and related Vue components (`FundingLayout.vue`, `FundingEffects.vue`, `docs/funding.md`)
- Removed stale `notifications` capability from MCP server init (removed in SDK v1.x)

### Fixed
- Converted all type-only imports to explicit `import type` syntax across the codebase
- Updated `docs/usage/commands.md` to document actual tools instead of non-existent slash commands
- Updated `docs/concepts/sandbox.md` to accurately describe sandbox mode behavior
- Fixed `docs/getting-started.md` stale slash command references
- Fixed `docs/.vitepress/theme/Layout.vue` home page path check for new repo name
- Updated all Node.js version references in docs from v16 to v18

## [1.1.3]
- "gemini reads, claude edits"
- Added `changeMode` parameter to ask-gemini tool for structured edit responses using claude edit diff.
- Testing intelligent parsing and chunking for large edit responses (>25k characters). I recommend you provide a focused prompt, although large (2000+) line edits have had success in testing.
- Added structured response format with Analysis, Suggested Changes, and Next Steps sections
- Improved guidance for applying edits using Claude's Edit/MultiEdit tools, avoids reading...
- Testing token limit handling with continuation support for large responses

## [1.1.2]
- Gemini-2.5-pro quota limit exceeded now falls back to gemini-2.5-flash automatically. Unless you ask for pro or flash, it will default to pro.

## [1.1.1]

- Public
- Basic Gemini CLI integration
- Support for file analysis with @ syntax
- Sandbox mode support
