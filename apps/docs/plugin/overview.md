# Claude Code Plugin

The `@ask-llm/plugin` package integrates Ask LLM providers into Claude Code as a first-class plugin. It adds review skills, brainstorm agents, automated hooks, and CLI binaries for piping code to any provider.

## Installation

The plugin lives in the monorepo at `packages/claude-plugin`. To use it, clone the repo and install:

```bash
git clone https://github.com/Lykhoyda/ask-llm.git
cd ask-llm
yarn install && yarn build
```

The plugin auto-registers the Gemini MCP server via its `.mcp.json`. For Codex and Ollama features, you also need to add their MCP servers:

```bash
# Gemini — included automatically via plugin
# Codex — add manually
claude mcp add codex-cli -- npx -y ask-codex-mcp

# Ollama — add manually (requires Ollama running locally)
claude mcp add ollama -- npx -y ask-ollama-mcp
```

## What's Included

### Skills (Slash Commands)

| Command | Provider | Description |
|---------|----------|-------------|
| `/gemini-review` | Gemini | Get a second opinion on your current changes |
| `/codex-review` | Codex | Get a second opinion from GPT-5.4 |
| `/ollama-review` | Ollama | Local review — no data leaves your machine |
| `/brainstorm` | Multi | Send a topic to multiple providers in parallel |
| `/brainstorm-all` | All | Brainstorm with all three providers |

> `/codex-review`, `/ollama-review`, and `/brainstorm` require the respective MCP servers to be added separately (see Installation above).

### Agents

| Agent | Description |
|-------|-------------|
| `gemini-reviewer` | Isolated Gemini code review with confidence-based filtering |
| `codex-reviewer` | Isolated Codex code review with confidence-based filtering |
| `ollama-reviewer` | Local Ollama code review — no data leaves your machine |
| `brainstorm-coordinator` | Multi-LLM brainstorm: sends topic to providers in parallel, synthesizes consensus |

### Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| Stop hook | Session end | Sends worktree diff to Gemini for a 3-bullet advisory review |
| Pre-commit hook | Before `git commit` | Reviews staged changes and warns about critical issues (advisory, does not block) |

Both hooks use the Gemini provider via the `ask-gemini-run` CLI binary.

### CLI Binaries

| Command | Description |
|---------|-------------|
| `ask-gemini-run` | Pipe code or prompts directly to Gemini CLI |
| `ask-codex-run` | Pipe code or prompts directly to Codex CLI |
| `ask-ollama-run` | Pipe code or prompts directly to local Ollama |

## How It Works

The plugin uses several Claude Code integration points:

1. **`.mcp.json`** — Auto-registers the Gemini MCP server when the plugin is loaded
2. **Skills** (`skills/`) — User-invocable slash commands that trigger review or brainstorm workflows
3. **Agents** (`agents/`) — Handle the actual interaction with each provider using confidence-based filtering (80%+ threshold). Agents read `CLAUDE.md` for project conventions when available.
4. **Hooks** (`hooks/`) — Automate advisory Gemini reviews on session stop and before commits
5. **CLI binaries** (`src/`) — Enable piped analysis from shell: `git diff | ask-gemini-run "review this"`

## Requirements

- **Claude Code** installed and authenticated
- **Gemini CLI** authenticated (`gemini login`) — required for all hooks and Gemini features
- **Codex CLI** authenticated — required for `/codex-review` and brainstorm with Codex
- **Ollama** running locally — required for `/ollama-review` and brainstorm with Ollama
- For `/brainstorm`, at least two providers should be available for meaningful synthesis

## Source

- **Package:** `@ask-llm/plugin` (monorepo package, not published to npm)
- **Location:** [packages/claude-plugin](https://github.com/Lykhoyda/ask-llm/tree/main/packages/claude-plugin)
