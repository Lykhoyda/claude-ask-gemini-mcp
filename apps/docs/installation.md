# Installation

Multiple ways to install Gemini MCP Tool, depending on your needs.

## Prerequisites

- Node.js v20.0.0 or higher (LTS)
- Claude Desktop or Claude Code with MCP support
- Gemini CLI installed (`npm install -g @google/gemini-cli`)

## Method 1: NPX (Recommended)

No installation needed - runs directly:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "ask-gemini-mcp"]
    }
  }
}
```

## Method 2: Global Installation

```bash
claude mcp add gemini-cli -- npx -y ask-gemini-mcp
```

Then configure:
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp"
    }
  }
}
```

## Method 3: Local Project

```bash
npm install ask-gemini-mcp
```

See [Getting Started](/getting-started) for full setup instructions.