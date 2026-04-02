# Gemini

Bridge Claude with Google's Gemini via the official Gemini CLI. Leverages Gemini's massive 1M+ token context window for large file and codebase analysis while Claude handles interaction and code editing.

## Installation

```bash
# Claude Code (recommended)
claude mcp add gemini-cli -- npx -y ask-gemini-mcp

# Or install globally
npm install -g ask-gemini-mcp
```

## Prerequisites

1. **Node.js** v20.0.0 or higher
2. **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and authenticated:

```bash
npm install -g @google/gemini-cli
gemini login
```

## Tools

| Tool | Purpose |
|------|---------|
| `ask-gemini` | Send prompts to Gemini CLI with `@` file syntax. Supports sandbox mode and multi-turn sessions |
| `ask-gemini-edit` | Structured code edits via Gemini changeMode. Returns OLD/NEW edit blocks |
| `fetch-chunk` | Retrieve subsequent chunks from cached large responses |
| `ping` | Fast connection test to verify MCP setup |

## Models

- **Default:** `gemini-3.1-pro-preview` (latest, highest capability)
- **Fallback:** `gemini-3-flash-preview` (automatic on quota errors)

## Key Features

- **1M+ token context** for analyzing entire codebases
- **Multi-turn sessions** via `sessionId` for conversation continuity
- **Include directories** for monorepo context (`includeDirs` parameter)
- **Sandbox mode** for safe code execution
- **Automatic quota fallback** from Pro to Flash

## npm

- **Package:** [ask-gemini-mcp](https://www.npmjs.com/package/ask-gemini-mcp)
- **Binary:** `gemini-mcp`
