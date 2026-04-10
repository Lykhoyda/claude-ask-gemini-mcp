# @ask-llm/plugin

<div align="center">

**Claude Code plugin for AI-to-AI collaboration**

</div>

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that adds multi-provider code review, brainstorming, and automated hooks. Get second opinions from Gemini, Codex, and Ollama without leaving Claude Code.

Part of the [Ask LLM](https://github.com/Lykhoyda/ask-llm) monorepo.

## Installation

### From Marketplace

```
/plugin marketplace add Lykhoyda/ask-llm
/plugin install ask-llm@ask-llm-plugins
```

### MCP Servers (user scope for short tool names)

```bash
claude mcp add --scope user gemini -- npx -y ask-gemini-mcp
claude mcp add --scope user codex -- npx -y ask-codex-mcp
claude mcp add --scope user ollama -- npx -y ask-ollama-mcp
```

## Skills

| Command | Description |
|---------|-------------|
| `/multi-review` | Parallel Gemini + Codex review with 4-phase validation pipeline and consensus highlighting |
| `/gemini-review` | Gemini-only code review with confidence filtering |
| `/codex-review` | Codex-only code review |
| `/ollama-review` | Local review — no data leaves your machine |
| `/brainstorm` | Multi-LLM brainstorm (default: gemini,codex) |
| `/brainstorm-all` | Brainstorm with all three providers |

## Agents

| Agent | Color | Description |
|-------|-------|-------------|
| gemini-reviewer | cyan | 4-phase: context, prompt, synthesis, validation |
| codex-reviewer | green | 4-phase: context, prompt, synthesis, validation |
| ollama-reviewer | yellow | 4-phase: context, prompt, synthesis, validation (local) |
| brainstorm-coordinator | magenta | Parallel multi-LLM consultation with synthesis |

## Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| PreToolUse | Before `git commit` | Reviews staged changes, warns about critical issues |

## Requirements

- **Claude Code** installed
- **Gemini CLI** authenticated — required for hooks and Gemini features
- **Codex CLI** — required for `/codex-review` and brainstorm with Codex
- **Ollama** running locally — required for `/ollama-review`

## Documentation

Full docs at [lykhoyda.github.io/ask-llm/plugin/overview](https://lykhoyda.github.io/ask-llm/plugin/overview)

## License

MIT
