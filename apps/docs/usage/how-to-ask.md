# How to Ask Gemini

You don't need to memorize commands or rigid syntax to use this tool, because **Ask Gemini MCP** is designed for natural language collaboration.

## 🗣️ Just Ask Naturally

Because Claude natively integrates with MCP tools, it knows when to route your request to Gemini. You can just speak to it normally:

- *"Hey, can Gemini check if my config.js is valid?"*
- *"Use Gemini to explain how this auth flow works."*
- *"Ask Gemini to suggest 3 ways to optimize my database queries."*
- *"Have Gemini review my latest changes for security issues."*

### Mixing Tool Context Automatically
You can combine an error log you are debugging with a request to Gemini without needing to manually pass files:

`"I'm getting a null pointer error in my auth handler here. Gemini, can you help me find the bug?"`
*(Claude will automatically extract the relevant files from its context and send them to Gemini for you).*

---

## ⚙️ Under The Hood (The MCP Tools)

For advanced users or when creating automated AI agent workflows, these are the actual MCP tools that the server exposes to your client.

### `ask-gemini`
The core tool that sends your prompts and context to the Gemini API.

**Parameters:**
- `prompt` (required): The question or analysis request. Supports the `@` syntax for direct file inclusion.
- `model` (optional): The Gemini model to use (`gemini-3.1-pro-preview` or `gemini-3-flash-preview`). Automatically falls back to Flash if Pro quotas are exceeded.
- `sandbox` (optional): Set to `true` to run your prompt inside Gemini's isolated code execution sandbox (`-s` flag).
- `changeMode` (optional): Set to `true` to strongly encourage Gemini to format its output as structured code edits.
- `sessionId` (optional): Resume a previous conversation. Pass the session ID from a prior response to continue a [multi-turn session](/usage/multi-turn-sessions).
- `includeDirs` (optional): An array of additional directory paths to include in Gemini's context via `--include-directories`. Useful for monorepos where the code you want analyzed lives outside the current working directory (e.g., `["packages/api", "packages/shared"]`).

### `fetch-chunk`
Used automatically by your AI client. When Gemini returns a response larger than a single MCP message allows, it is cached. The AI uses this tool to paginate through the rest of the response.

**Parameters:**
- `chunkCacheKey` (required): The unique ID of the cached response.
- `chunkIndex` (optional): Which chunk to return (1-based index).

### `ping`
A zero-cost diagnostic tool to verify the MCP server is running correctly.

**Parameters:**
- `message` (optional): An echo message.
