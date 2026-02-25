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
- **Status:** Approved, not yet implemented
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
- **Design doc:** [docs/plans/2026-02-25-structured-json-output-design.md](plans/2026-02-25-structured-json-output-design.md)

## ADR-017: Smithery CJS Compatibility — createSandboxServer Export
- **Date:** 2026-02-24
- **Status:** Accepted
- **Context:** Smithery bundles MCP servers with esbuild in CJS mode for capability scanning. Our ESM code uses `createRequire(import.meta.url)` to read `package.json` at runtime, but in CJS bundles `import.meta` is empty (undefined), causing the module to crash on load. This prevented Smithery from scanning tool/prompt schemas.
- **Decision:** (1) Wrap `createRequire(import.meta.url)` in a try/catch with hardcoded fallback values (`name: "ask-gemini-mcp"`, `version: "0.0.0"`). (2) Export a `createSandboxServer()` function that returns a configured `McpServer` with tools/prompts registered via stub handlers — Smithery's recommended pattern for servers that need special handling during scanning. (3) Separate CLI entry point (`src/cli.ts`) from library module (`src/index.ts`) — `index.ts` no longer auto-executes `main()`, preventing stdio conflicts when Smithery imports the module. `package.json` `bin` now points to `dist/cli.js`.
- **Consequences:** The module loads cleanly in both ESM (normal operation) and CJS (Smithery bundling) contexts. Smithery can scan tool schemas without invoking real Gemini CLI or triggering stdio transport. The fallback version "0.0.0" is only used in CJS bundles, not in production stdio operation.
