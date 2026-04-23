# Ask Codex MCP

<div align="center">

[![npm version](https://img.shields.io/npm/v/ask-codex-mcp)](https://www.npmjs.com/package/ask-codex-mcp)
[![npm downloads](https://img.shields.io/npm/dt/ask-codex-mcp)](https://www.npmjs.com/package/ask-codex-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**MCP server that connects any AI client to OpenAI Codex CLI**

</div>

An [MCP](https://modelcontextprotocol.io/) server for AI-to-AI collaboration via the Codex CLI. Works with Claude Code, Claude Desktop, Cursor, Warp, Copilot, and [40+ other MCP clients](https://modelcontextprotocol.io/clients). Access GPT-5.4 for code generation, analysis, and review with automatic fallback to GPT-5.4-mini on quota limits.

Part of the [Ask LLM](https://github.com/Lykhoyda/ask-llm) monorepo.

## Quick Start

### Claude Code

```bash
claude mcp add codex -- npx -y ask-codex-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codex": {
      "command": "npx",
      "args": ["-y", "ask-codex-mcp"]
    }
  }
}
```

### Any MCP Client

```json
{
  "command": "npx",
  "args": ["-y", "ask-codex-mcp"]
}
```

## Prerequisites

- **[Node.js](https://nodejs.org/)** v20.0.0 or higher
- **[Codex CLI](https://github.com/openai/codex)** installed and authenticated

## Tools

| Tool | Purpose |
|------|---------|
| `ask-codex` | Send prompts to Codex CLI. Defaults to GPT-5.4 with automatic mini fallback |
| `ping` | Connection test — verify MCP setup without using tokens |

## Models

| Model | Use Case |
|-------|----------|
| `gpt-5.5` | Default — highest capability |
| `gpt-5.5-mini` | Automatic fallback on quota errors |

## Documentation

Full docs at [lykhoyda.github.io/ask-llm](https://lykhoyda.github.io/ask-llm/)

## License

MIT
