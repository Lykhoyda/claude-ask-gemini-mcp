# Getting Started

Follow these three steps to integrate Gemini deeply inside your favorite AI coding assistant.

## Step 1: Install Prerequisites

Before configuring your client, ensure your system has the required dependencies.

1. **[Node.js](https://nodejs.org/)**: You must have Node `v20.0.0` or higher installed (LTS versions 20 and 22 are actively supported).
2. **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)**: Install the CLI globally.
   ```bash
   npm install -g @google/gemini-cli
   ```

## Step 2: Authenticate Gemini

The MCP server piggybacks entirely off of the official Gemini CLI authentication, meaning you never need to copy, paste, or expose your API keys in config files.

Run the following command in your terminal and follow the browser prompts to log in via OAuth:
```bash
gemini login
```
*Tip: Verify it works by running `gemini "Hello world"` in your terminal.*

---

## Step 3: Configure Your MCP Client

Now you need to tell your primary AI assistant (like Claude) where the MCP server is.

### Option A: Claude Code (Recommended) ❋
Claude Code is Anthropic's terminal-native tool. It offers the fastest, most cohesive experience simply by running a single command:

```bash
claude mcp add gemini-cli -- npx -y ask-gemini-mcp
```

### Option B: Claude Desktop 🖥️
To install the server in the Claude Desktop app, add the following to your configuration file:

<details>
<summary><strong>Where is my config file located?</strong></summary>
<ul>
<li><strong>macOS</strong>: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
<li><strong>Windows</strong>: <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
<li><strong>Linux</strong>: <code>~/.config/claude/claude_desktop_config.json</code></li>
</ul>
</details>

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
*⚠️ **Important:** You must restart Claude Desktop completely for changes to take effect.*

### Option C: Generic STDIO Transport (Cursor, Warp, Copilot, etc.) 📂
Ask Gemini MCP works with **[40+ MCP-compatible clients](https://modelcontextprotocol.io/clients)**. Almost all of them use the standard STDIO transport pattern. Provide your client with this configuration:

```json
{
  "command": "npx",
  "args": ["-y", "ask-gemini-mcp"],
  "env": {}
}
```

---

## Verify Your Setup

Once installed, verify the connection works by asking Claude to use the `ping` tool:

```text
"Use Gemini ping to test the connection"
```
If you get a *Pong!* back, you're ready to start analyzing massive codebases with Gemini! Head over to the [How to Ask user guide](/usage/how-to-ask) to learn more.

---

## Advanced Configuration (Environment Variables)

You can configure the behavior of the server using environment variables in your MCP client's configuration block.

| Variable | Default | Description |
|---|---|---|
| `GMCPT_LOG_LEVEL` | `warn` | Minimum log level to output to `stderr`. Valid options: `debug`, `info`, `warn`, `error`. Increase to `debug` if you need to troubleshoot connection issues. |
| `GMCPT_TIMEOUT_MS` | `300000` | The maximum amount of time (in milliseconds) before the server assumes the Gemini CLI process has hung and forcibly terminates it. Defaults to `300000` (5 minutes). |