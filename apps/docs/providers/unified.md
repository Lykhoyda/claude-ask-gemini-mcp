# Unified (ask-llm-mcp)

All providers in one MCP server. Auto-detects which CLIs are installed and registers only the available tools. One install, all providers.

## Installation

```bash
# Claude Code (recommended)
claude mcp add ask-llm -- npx -y ask-llm-mcp

# Or install globally
npm install -g ask-llm-mcp
```

## Prerequisites

1. **Node.js** v20.0.0 or higher
2. **At least one provider** installed and authenticated:
   - [Gemini CLI](https://github.com/google-gemini/gemini-cli) for `ask-gemini` tools
   - [Codex CLI](https://github.com/openai/codex) for `ask-codex` tools
   - [Ollama](https://ollama.com) running locally for `ask-ollama` tools

## How It Works

On startup, the unified server:

1. Checks for CLI availability via `which` (Gemini, Codex)
2. Checks for HTTP availability via health endpoints (Ollama)
3. Dynamically imports and registers tools from available providers
4. Exposes only the tools for providers that are actually installed

## Tools

All tools from installed providers are registered. If you have all three:

| Tool | Provider | Purpose |
|------|----------|---------|
| `ask-gemini` | Gemini | Prompts via Gemini CLI |
| `ask-gemini-edit` | Gemini | Structured code edits |
| `fetch-chunk` | Gemini | Large response chunks |
| `ask-codex` | Codex | Prompts via Codex CLI |
| `ask-ollama` | Ollama | Prompts via local Ollama |
| `ping` | All | Connection test per provider |

## Key Features

- **Single server** for all providers
- **Auto-detection** of installed CLIs
- **Dynamic tool registration** based on availability
- **Graceful degradation** if a provider is unavailable

## npm

- **Package:** [ask-llm-mcp](https://www.npmjs.com/package/ask-llm-mcp)
- **Binary:** `ask-llm-mcp`
