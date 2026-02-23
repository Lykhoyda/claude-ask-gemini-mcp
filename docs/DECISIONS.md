# Architectural Decisions

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
