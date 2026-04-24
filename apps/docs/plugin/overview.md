---
description: Claude Code plugin for AI-to-AI collaboration. Multi-provider code review, brainstorming agents, pre-commit hooks, and CLI binaries for Gemini, Codex, and Ollama.
---

# Claude Code Plugin

The `@ask-llm/plugin` package integrates Ask LLM providers into Claude Code as a first-class plugin. It adds review skills, brainstorm agents, automated hooks, and CLI binaries for piping code to any provider.

## Installation

### From Marketplace (recommended)

Add the Ask LLM marketplace, then install the plugin:

```bash
/plugin marketplace add Lykhoyda/ask-llm
/plugin install ask-llm@ask-llm-plugins
```

### From Source (development)

```bash
git clone https://github.com/Lykhoyda/ask-llm.git
cd ask-llm
yarn install && yarn build
claude --plugin-dir ./packages/claude-plugin
```

### MCP Servers

Add the MCP servers at user scope for short tool names (recommended):

```bash
claude mcp add --scope user gemini -- npx -y ask-gemini-mcp
claude mcp add --scope user codex -- npx -y ask-codex-mcp
claude mcp add --scope user ollama -- npx -y ask-ollama-mcp
```

This gives you `gemini:ask-gemini` rather than `plugin:ask-llm:gemini:ask-gemini`.

## What's Included

### Skills (Slash Commands)

| Command | Provider | Description |
|---------|----------|-------------|
| `/multi-review` | Gemini + Codex | Parallel review with 4-phase validation pipeline and consensus highlighting |
| `/gemini-review` | Gemini | Get a second opinion on your current changes |
| `/codex-review` | Codex | Get a second opinion from GPT-5.5 |
| `/ollama-review` | Ollama | Local review — no data leaves your machine |
| `/brainstorm` | Multi + Claude Opus | Claude Opus researches the topic against real files in parallel with external providers, then synthesizes findings |
| `/brainstorm-all` | All + Claude Opus | Brainstorm with all three external providers plus Claude Opus research |
| `/compare` | Multi (configurable) | Side-by-side raw responses from selected providers — no synthesis, no consensus extraction. Use when you want to see how each provider phrases the same answer |

> `/codex-review`, `/ollama-review`, and `/brainstorm` require the respective CLI tools to be installed and authenticated.

### Agents

| Agent | Description |
|-------|-------------|
| `gemini-reviewer` | Isolated Gemini code review with confidence-based filtering |
| `codex-reviewer` | Isolated Codex code review with confidence-based filtering |
| `ollama-reviewer` | Local Ollama code review — no data leaves your machine |
| `brainstorm-coordinator` | First-class research participant: runs its own Claude Opus research (reads real files, traces code, fetches docs) in parallel with external providers, then synthesizes consensus. Verified findings weighted higher than inferred ones. |

### Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| Pre-commit hook | Before `git commit` | Reviews staged changes and warns about critical issues (advisory, does not block) |

The hook uses the Gemini CLI directly (`gemini -p` with `@` file syntax).

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
4. **Hooks** (`hooks/`) — Automate advisory Gemini reviews before commits
5. **CLI binaries** (`src/`) — Enable piped analysis from shell: `git diff | ask-gemini-run "review this"`

## Requirements

- **Claude Code** installed and authenticated
- **Gemini CLI** authenticated (`gemini login`) — required for all hooks and Gemini features
- **Codex CLI** authenticated — required for `/codex-review` and brainstorm with Codex
- **Ollama** running locally — required for `/ollama-review` and brainstorm with Ollama
- For `/brainstorm`, at least two providers should be available for meaningful synthesis

## Source

- **Marketplace:** `/plugin marketplace add Lykhoyda/ask-llm` then `/plugin install ask-llm@ask-llm-plugins`
- **Source:** [packages/claude-plugin](https://github.com/Lykhoyda/ask-llm/tree/main/packages/claude-plugin)
