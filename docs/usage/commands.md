# Commands Reference

Complete list of available tools and their usage.

## Tools

### `ask-gemini`
The core tool — sends prompts to Gemini CLI for analysis, code review, or general questions.

**Parameters:**
- `prompt` (required): The question or analysis request. Use `@` syntax to include files.
- `model` (optional): Gemini model to use (`gemini-3.1-pro-preview` or `gemini-3-flash-preview`).
- `sandbox` (optional): Set to `true` to run in Gemini's sandbox mode (`-s` flag).
- `changeMode` (optional): Set to `true` for structured edit responses.

### `fetch-chunk`
Retrieves subsequent chunks from cached large responses.

**Parameters:**
- `chunkCacheKey` (required): Cache key from a previous chunked response.
- `chunkIndex` (optional): Which chunk to return (1-based).

### `ping`
Tests connectivity with the MCP server.

**Parameters:**
- `message` (optional): A message to echo back.

## Natural Language Usage

You don't need to call tools directly — use natural language instead:

- "Use gemini to analyze index.js"
- "Ask gemini to review my approach"
- "Have gemini explain this error"
- "Brainstorm solutions for this problem with gemini"

## File Patterns (@ syntax)

### Single File
```
@README.md
@src/index.js
```

### Multiple Files
```
@file1.js @file2.js @file3.js
```

### Wildcards
```
@*.json           # All JSON files in current directory
@src/*.js         # All JS files in src
@**/*.test.js     # All test files recursively
```

### Directory
```
@src/             # All files in src
@.                # Current directory
```

## Tips

1. **Start simple**: Begin with single files before using patterns
2. **Be specific**: Clear questions get better answers
3. **Use context**: Include relevant files for better analysis
4. **Iterate**: Refine your queries based on responses
