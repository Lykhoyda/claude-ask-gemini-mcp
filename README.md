
# Gemini MCP Tool

<div align="center">

[![npm version](https://img.shields.io/npm/v/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![npm downloads](https://img.shields.io/npm/dt/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![GitHub Release](https://img.shields.io/github/v/release/Lykhoyda/claude-ask-gemini-mcp?logo=github&label=GitHub)](https://github.com/Lykhoyda/claude-ask-gemini-mcp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

</div>

An MCP server that bridges Claude with Google Gemini CLI for AI-to-AI collaboration. **Gemini reads, Claude edits** — leverage Gemini's massive token window (1M tokens) for large file and codebase analysis while Claude handles interaction and code editing.

## Why?

- **Get a second opinion** — Ask Gemini to review your coding approach before committing to it
- **Debate plans** — Send architecture proposals to Gemini for critique and alternative suggestions
- **Review changes** — Have Gemini analyze diffs or modified files to catch issues Claude might miss

## Quick Start

### One-Line Setup (Claude Code)

```bash
claude mcp add gemini-cli -- npx -y gemini-mcp-tool
```

Type `/mcp` inside Claude Code to verify the `gemini-cli` MCP is active.

### Claude Desktop

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool"]
    }
  }
}
```

**Config file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

Restart Claude Desktop after updating the config.

## Prerequisites

- **[Node.js](https://nodejs.org/)** v18.0.0 or higher
- **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and configured

## Tools

| Tool | Purpose |
|------|---------|
| `ask-gemini` | Core tool: sends prompts to Gemini CLI. Supports `@` file syntax, model selection, sandbox mode, and changeMode for structured edits |
| `fetch-chunk` | Retrieves subsequent chunks from cached large responses |
| `ping` | Connection test — verifies MCP setup without using Gemini tokens |

### Usage Examples

**With file references (@ syntax):**
- `ask gemini to analyze @src/main.js and explain what it does`
- `use gemini to summarize @. the current directory`

**General questions:**
- `ask gemini about best practices for React development`
- `use gemini to explain div centering`

**Sandbox mode:**
- `use gemini sandbox to create and run a Python script`

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

**Disclaimer:** This is an unofficial, third-party tool and is not affiliated with, endorsed, or sponsored by Google.
