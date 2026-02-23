## Getting Started

<div align="center">⇣ Find your setup ↴</div>

<ClientGrid>
  <div class="client-card client-card--recommended claude-code-card">
    <h3><span class="snowflake">❋</span> Claude Code</h3>
    <div class="client-badge">Power Users</div>
    <p>One-command setup</p>
    <a href="#claude-code-recommended" class="client-button">Get Started →</a>
  </div>
  
  <div class="client-card">
    <h3>🖥️ <br>Claude Desktop</h3>
    <div class="client-badge">Everyday users</div>
    <p>JSON configuration</p>
    <a href="#claude-desktop" class="client-button">Setup Guide →</a>
  </div>
  
  <div class="client-card">
    <h3>📂 Other Clients</h3>
    <div class="client-badge">40+ Options</div>
    <p>Warp, Copilot, and More</p>
    <a href="#other-mcp-clients" class="client-button">More →</a>
  </div>
</ClientGrid>

## Client Setup

## Prerequisites

Before installing, ensure you have:

- **[Node.js](https://nodejs.org/)** v20.0.0 or higher (LTS)
- **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and configured on your system
- **[Claude Desktop](https://claude.ai/download)** or **[Claude Code](https://www.anthropic.com/claude-code)** with MCP support


## Claude Code (Recommended)
::: warning 💡 ask-gemini-mcp is tested extensively with claude code
:::
Claude Code offers the smoothest experience.

```bash
# install for claude code
claude mcp add gemini-cli -- npx -y ask-gemini-mcp

# Start Claude Code - it's automatically configured!
claude
```

## Claude Desktop
---
#### Configuration File Locations

<ConfigModal>

*Where are my Claude Desktop Config Files?:*

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

</ConfigModal>

---

For Claude Desktop users, add this to your configuration file:

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

::: warning
You must restart Claude Desktop ***completely*** for changes to take effect.
:::
## Other MCP Clients

Ask Gemini MCP works with 40+ MCP clients! Here are the common configuration patterns:

### STDIO Transport (Most Common)
```json
{
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "ask-gemini-mcp"]
  }
}
```

### Popular Clients

<details>
<summary><strong>Warp</strong> - Modern terminal with AI features</summary>

**Configuration Location:** Terminal Settings → AI Settings → MCP Configuration

```json
{
  "gemini-cli": {
    "command": "npx",
    "args": [
      "-y",
      "ask-gemini-mcp"
    ],
    "env": {},
    "working_directory": null,
    "start_on_launch": true
  }
}
```

**Features:** Terminal-native MCP integration, AI-powered command suggestions
</details>
### Generic Setup Steps

1. **Install Prerequisites**: Ensure [Gemini CLI](https://github.com/google-gemini/gemini-cli) is installed
2. **Add Server Config**: Use the STDIO transport pattern above
3. **Restart Client**: Most clients require restart after config changes
4. **Test Connection**: Try `ping` via MCP or use natural language commands

## Verify Your Setup

Once configured, test that everything is working:

### 1. Basic Connectivity Test
Type in Claude:
```
use gemini ping to test the connection
```

### 2. Test File Analysis
```
ask gemini to summarize @README.md
```

### 3. Test Sandbox Mode
```
ask gemini in sandbox mode to create a simple Python hello world script
```

## Quick Command Reference

Once installed, use natural language to interact with Gemini:

### Natural Language Examples
- "use gemini to explain index.html"
- "understand the massive project using gemini"
- "ask gemini to search for latest news"

### Available Tools
These tools are registered via MCP and can be used through natural language:
- `ask-gemini` - Analyze files, ask questions, get code reviews
- `fetch-chunk` - Retrieve paginated chunks from large responses
- `ping` - Test connectivity

## Need a Different Client?

Don't see your MCP client listed? Ask Gemini MCP uses the standard MCP protocol and works with any compatible client.

::: tip Find More MCP Clients
- **Official List**: [modelcontextprotocol.io/clients](https://modelcontextprotocol.io/clients)
- **Configuration Help**: Most clients follow the STDIO transport pattern above
- **Community**: Join discussions on GitHub for client-specific tips
:::

## Common Issues

### "Command not found: gemini"
Make sure you've installed the Gemini CLI:
```bash
npm install -g @google/gemini-cli
```

### "MCP server not responding"
0. run claude code --> /doctor
1. Check your configuration file path
2. Ensure JSON syntax is correct
3. Restart your MCP client completely
4. Verify Gemini CLI works: `gemini -help`


### Client-Specific Issues
- **Claude Desktop**: Must restart completely after config changes
- **Other Clients**: Check their specific documentation for MCP setup

## Next Steps

Now that you're set up:
- Learn about file analysis with @ syntax
- Explore sandbox mode for safe code execution
- Check out real-world examples in the README
- Join the community for support

::: info Need Help?
If you run into issues, [open an issue](https://github.com/Lykhoyda/ask-gemini-mcp/issues) on GitHub.
:::

## Advanced Configuration (Environment Variables)

You can configure the behavior of the server using environment variables in your MCP client's configuration block.

| Variable | Default | Description |
|---|---|---|
| `GMCPT_LOG_LEVEL` | `warn` | Minimum log level to output to `stderr`. Valid options: `debug`, `info`, `warn`, `error`. Increase to `debug` if you need to troubleshoot connection issues. |
| `GMCPT_TIMEOUT_MS` | `300000` | The maximum amount of time (in milliseconds) before the server assumes the Gemini CLI process has hung and forcibly terminates it. Defaults to 5 minutes. |

**Example (Warp):**
```json
{
  "gemini-cli": {
    "command": "npx",
    "args": ["-y", "ask-gemini-mcp"],
    "env": {
      "GMCPT_LOG_LEVEL": "debug"
    }
  }
}
```