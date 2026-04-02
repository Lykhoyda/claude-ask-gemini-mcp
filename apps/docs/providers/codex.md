# Codex

Bridge Claude with OpenAI's Codex CLI. Access GPT-5.4 for code generation, analysis, and review with automatic fallback to GPT-5.4-mini on quota limits.

## Installation

```bash
# Claude Code (recommended)
claude mcp add codex-cli -- npx -y ask-codex-mcp

# Or install globally
npm install -g ask-codex-mcp
```

## Prerequisites

1. **Node.js** v20.0.0 or higher
2. **[Codex CLI](https://github.com/openai/codex)** installed and authenticated

## Tools

| Tool | Purpose |
|------|---------|
| `ask-codex` | Send prompts to Codex CLI. Defaults to GPT-5.4 with automatic mini fallback |
| `ping` | Fast connection test to verify MCP setup |

## Models

- **Default:** `gpt-5.4` (highest capability)
- **Fallback:** `gpt-5.4-mini` (automatic on quota errors)

## Key Features

- **GPT-5.4 access** via the official Codex CLI
- **JSONL output parsing** for structured responses
- **Automatic quota fallback** from GPT-5.4 to mini
- **Standard MCP transport** works with 40+ clients

## npm

- **Package:** [ask-codex-mcp](https://www.npmjs.com/package/ask-codex-mcp)
- **Binary:** `ask-codex-mcp`
