# Ollama

Run local LLMs via Ollama's HTTP API. No API keys needed, fully private, zero cost. Uses native `fetch` against Ollama's local server.

## Installation

```bash
# Claude Code (recommended)
claude mcp add ollama -- npx -y ask-ollama-mcp

# Or install globally
npm install -g ask-ollama-mcp
```

## Prerequisites

1. **Node.js** v20.0.0 or higher
2. **[Ollama](https://ollama.com)** installed and running locally
3. **A model pulled:**

```bash
ollama pull qwen2.5-coder:7b
```

## Tools

| Tool | Purpose |
|------|---------|
| `ask-ollama` | Send prompts to local Ollama via HTTP. Defaults to qwen2.5-coder:7b |
| `ping` | Lists locally available Ollama models via /api/tags |

## Models

- **Default:** `qwen2.5-coder:7b` (good balance of speed and capability)
- **Fallback:** `qwen2.5-coder:1.5b` (automatic on model-not-found)

## Configuration

Set `OLLAMA_HOST` environment variable to customize the Ollama server address (defaults to `http://localhost:11434`).

## Key Features

- **No API keys** required
- **Fully local** and private
- **Zero cost** per query
- **Model auto-detection** via `/api/tags` endpoint
- **Automatic model fallback** from 7b to 1.5b

## npm

- **Package:** [ask-ollama-mcp](https://www.npmjs.com/package/ask-ollama-mcp)
- **Binary:** `ask-ollama-mcp`
