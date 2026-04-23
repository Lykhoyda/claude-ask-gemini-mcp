---
description: Common issues and solutions for Ask LLM MCP servers. Connection errors, timeouts, quota limits, provider auth, and platform-specific fixes.
---

# Troubleshooting

> **Run the doctor first.** `npx ask-llm-mcp doctor` checks Node version, PATH, every provider CLI's presence + version, and env vars. It works even when MCP can't start. 90%+ of setup issues are caught here with a clear failed-check line — fix from the bottom of the report up.

```bash
npx ask-llm-mcp doctor          # human-readable
npx ask-llm-mcp doctor --json   # machine-readable, exit 1 on error
```

<script setup>
import TroubleshootingModal from '../.vitepress/components/TroubleshootingModal.vue'
</script>

## Installation Issues

<TroubleshootingModal
  title='"Command not found: gemini" / "codex" / "ollama"'
  preview="Provider CLI is not installed or not on PATH"
>

A provider CLI is missing or not on PATH. Install:

```bash
# Gemini
npm install -g @google/gemini-cli && gemini login

# Codex
npm install -g @openai/codex
# then follow the codex CLI's auth instructions

# Ollama (https://ollama.com)
ollama pull qwen2.5-coder:7b
```

Verify:

```bash
gemini --version    # or: which gemini
codex --version
ollama list
```

If `npx ask-llm-mcp doctor` reports a CLI as "not found on PATH" but `which <cli>` works in your terminal, the issue is PATH inheritance — see the next entry.

</TroubleshootingModal>

<TroubleshootingModal
  title='"PATH issue" — CLI works in terminal but MCP server says "not found"'
  preview="macOS GUI apps don't inherit your shell PATH"
>

macOS GUI applications (Claude Desktop, Cursor, etc.) don't source `.zshrc` / `.bashrc`, so nvm / Homebrew / Volta paths aren't visible to the MCP server. Ask LLM resolves this automatically per [ADR-047](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md) by extracting the real PATH from your login shell at startup.

If it's still failing:

1. Confirm `npx ask-llm-mcp doctor` shows a non-empty `Resolved PATH` with the CLI's directory in it.
2. If it doesn't, set `ASK_LLM_PATH` explicitly in your MCP client's env config:

```json
{
  "mcpServers": {
    "ask-llm": {
      "command": "npx",
      "args": ["-y", "ask-llm-mcp"],
      "env": {
        "ASK_LLM_PATH": "/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/v22.0.0/bin"
      }
    }
  }
}
```

3. Restart your MCP client completely (not just reload).

</TroubleshootingModal>

<TroubleshootingModal
  title="Windows NPX flag issues"
  preview='error: unknown option "-y" when using Claude Code on Windows'
>

**Solutions** (try in order):

```bash
# Method 1: Install globally first (skips npx entirely)
npm install -g ask-llm-mcp
claude mcp add --scope user ask-llm -- ask-llm-mcp

# Method 2: --yes instead of -y
claude mcp add --scope user ask-llm -- npx --yes ask-llm-mcp

# Method 3: Drop the flag entirely
claude mcp add --scope user ask-llm -- npx ask-llm-mcp
```

</TroubleshootingModal>

<TroubleshootingModal
  title="MCP server not responding (Claude Desktop cannot connect)"
  preview="Server fails to start or connection drops"
>

**Step-by-step:**

1. **Check Node.js version** — must be ≥ v20:
   ```bash
   node --version
   ```
2. **Run the doctor** to identify what's missing:
   ```bash
   npx ask-llm-mcp doctor
   ```
3. **Verify Claude Desktop config syntax** — use a JSON validator. Common bugs: trailing commas, missing brackets.
4. **Restart Claude Desktop completely**:
   - Quit (Cmd+Q on Mac), wait 5s, reopen.
   - Just reloading the window is not enough.
5. **Check logs** for the actual error:
   - macOS: `~/Library/Logs/Claude/mcp-server-*.log`
   - Windows: `%APPDATA%\Claude\logs\`

</TroubleshootingModal>

<TroubleshootingModal
  title='"npm install fails: EUNSUPPORTEDPROTOCOL workspace:*"'
  preview='npm 9 or older choking on workspace:* in published packages'
>

You're on npm 9 (probably bundled with Node 18 in Claude Desktop). [ADR-052](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md) fixed this in published packages 1.5.7 / 0.2.7 and later — the `workspace:*` protocol is rewritten to `*` at publish time so npm 9's arborist parses it correctly.

If you're still hitting this:

1. Confirm your installed version is recent: `npm view ask-llm-mcp version`
2. Clear the npx cache: `rm -rf ~/.npm/_npx`
3. Reinstall: `npx -y ask-llm-mcp@latest`

If still broken, upgrade Node to ≥ v20 (npm 10+) — older npm versions have other quirks too.

</TroubleshootingModal>

## Connection & Auth

<TroubleshootingModal
  title='"Authentication failed" / "401 Unauthorized"'
  preview="Provider CLI isn't authenticated"
>

Each provider has its own auth flow:

- **Gemini**: `gemini login` (OAuth) or set `GEMINI_API_KEY` env var
- **Codex**: follow `codex` CLI's auth instructions (varies by version)
- **Ollama**: no auth needed; Ollama just needs to be running locally

Verify each CLI works directly before blaming the MCP server:

```bash
gemini "Hello"
codex exec --skip-git-repo-check "Hello"
curl http://localhost:11434/api/tags    # Ollama
```

</TroubleshootingModal>

<TroubleshootingModal
  title='Quota / rate limit errors (Gemini RESOURCE_EXHAUSTED, Codex 429)'
  preview="Provider quota exhausted"
>

**The executor handles this automatically** — Gemini falls back from `gemini-3.1-pro-preview` to `gemini-3-flash-preview` per [ADR-044](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md), Codex falls back from `gpt-5.5` to `gpt-5.5-mini` per [ADR-028](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md) (model bumped in [ADR-067](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md)). You'll see `usage.fellBack: true` in the structured response.

If both Pro and Flash (or both gpt-5.5 and mini) hit quota, the call fails with both errors surfaced. Wait for the quota window to reset, or:

- Switch to a different provider for the meantime: `Use ask-llm with provider codex ...` instead of Gemini
- Use Ollama locally: `Use ask-llm with provider ollama ...`

</TroubleshootingModal>

<TroubleshootingModal
  title='"Timeout after 210000ms"'
  preview="Provider call exceeded server timeout"
>

The default per-provider timeout is 210s (3.5 min) — set just below Claude Desktop's 4-min client cap so server-side errors return before client gives up ([ADR-045](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md)).

For long analyses (large diffs, complex Codex reasoning):

1. **Override the timeout** via env var:
   ```json
   { "env": { "GMCPT_TIMEOUT_MS": "600000" } }    // 10 minutes
   ```
   Note: Claude Desktop will still cut you off at ~4 minutes regardless. For longer runs, use the REPL or call the executor directly.

2. **For multi-provider review skills** (`/multi-review`, `/brainstorm`), large diffs may take 5–15 min — use the diff size policy in those skills (filter docs/binaries, truncate above 150KB) to keep them tractable.

3. **For very large prompts**, consider splitting the work or using `ask-gemini` with `includeDirs` instead of one giant prompt.

</TroubleshootingModal>

## Tool & API Issues

<TroubleshootingModal
  title='"Provider X is not available" / tool call rejects provider'
  preview="The orchestrator didn't detect the provider at startup"
>

The orchestrator (`ask-llm-mcp`) detects available providers at startup. If a provider you expected isn't there:

1. Run `npx ask-llm-mcp doctor` to see what it detects.
2. The most common cause is PATH not finding the provider CLI — see the PATH issue entry above.
3. For Ollama specifically, it must be **running** at `http://localhost:11434` (or wherever `OLLAMA_HOST` points). Not just installed.
4. Restart your MCP client to re-detect providers.

</TroubleshootingModal>

<TroubleshootingModal
  title='"Sub-agent silently produces 0-byte output" / brainstorm coordinator hang'
  preview="Provider process killed by sub-agent lifecycle"
>

This is the bug class [ADR-050](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md) addresses — Claude Code sub-agents can't own background processes that outlive their turn, so `(cmd &) && wait` patterns or `run_in_background: true` on dispatch calls cause processes to be SIGKILLed silently.

The brainstorm-coordinator agent uses the correct pattern (single foreground blocking Bash with direct backgrounding + per-PID wait + `timeout: 600000`). If you're seeing this in custom skills you're writing, follow the same pattern — see the agent prompt in `packages/claude-plugin/agents/brainstorm-coordinator.md` for the canonical template.

</TroubleshootingModal>

## Model & Response Issues

<TroubleshootingModal
  title="Response gets cut off mid-stream"
  preview="MCP message size limits or executor timeout"
>

For Gemini, large responses are chunked automatically — Claude can call `fetch-chunk` to retrieve subsequent chunks from the cached response.

For Codex / Ollama, very large responses can hit the MCP message limit. Workarounds:

- Ask for shorter responses ("3 bullets max", "1-paragraph summary")
- Split the work — run the prompt twice with narrower scope
- Use the REPL where output streams directly to stdout without MCP message size limits

</TroubleshootingModal>

## Plugin Issues

<TroubleshootingModal
  title="Plugin slash commands not appearing in Claude Code"
  preview="Plugin not installed or not loaded"
>

Verify the plugin is installed and active:

```text
/plugin list
```

If `ask-llm` isn't there, install it:

```text
/plugin marketplace add Lykhoyda/ask-llm
/plugin install ask-llm@ask-llm-plugins
/reload-plugins
```

The plugin's MCP servers also need to be registered — typically done at user scope:

```bash
claude mcp add --scope user gemini -- npx -y ask-gemini-mcp
claude mcp add --scope user codex  -- npx -y ask-codex-mcp
claude mcp add --scope user ollama -- npx -y ask-ollama-mcp
```

</TroubleshootingModal>

<TroubleshootingModal
  title="Pre-commit hook running on every Bash call, not just git commit"
  preview="The hook matches Bash but filters by command content"
>

Expected behavior — the hook is a `PreToolUse` matcher on `Bash`, but the script body checks the command for `git commit` and exits 0 immediately if it doesn't match. So it fires on every Bash call but does nothing for non-commit commands. Latency overhead is one shell invocation per Bash call (negligible).

If you want to disable it: edit `packages/claude-plugin/hooks/hooks.json` in your local plugin install (or fork) and remove the `PreToolUse` block.

</TroubleshootingModal>

## Debug Mode

Enable verbose logging:

```json
{
  "mcpServers": {
    "ask-llm": {
      "command": "npx",
      "args": ["-y", "ask-llm-mcp"],
      "env": {
        "GMCPT_LOG_LEVEL": "debug"
      }
    }
  }
}
```

Logs go to stderr. Claude Desktop captures them in:

- macOS: `~/Library/Logs/Claude/mcp-server-*.log`
- Windows: `%APPDATA%\Claude\logs\`
- Linux: `~/.config/claude/logs/`

## Getting Help

1. **Run the doctor first**: `npx ask-llm-mcp doctor`
2. Check [GitHub Issues](https://github.com/Lykhoyda/ask-llm/issues) for similar reports
3. Open a new issue with: doctor output, your client (Claude Code/Desktop/Cursor/etc.), Node version, OS, and what you ran
4. Ask in [GitHub Discussions](https://github.com/Lykhoyda/ask-llm/discussions) for usage questions
