# Structured JSON Output (ADR-019)

**Date:** 2026-02-25
**Status:** Accepted

## Context

The Gemini CLI supports `--output-format json` which returns structured responses:

```json
{
  "response": "the text response...",
  "stats": { "inputTokens": 1234, "outputTokens": 567, "model": "gemini-3.1-pro-preview" },
  "error": { "message": "...", "code": 429 }
}
```

Currently we parse raw text output, losing token usage stats and getting unstructured error messages.

## Decision

Always pass `--output-format json` to the Gemini CLI. Parse the JSON in `geminiExecutor.ts`, extract the `response` text, and append a one-line stats summary. Fall back to raw text if JSON parsing fails (backward compat with older CLI versions).

## Approach: Minimal — JSON parsing in geminiExecutor only

### Changes

**`src/constants.ts`**
- Add `CLI.FLAGS.OUTPUT_FORMAT = "--output-format"`
- Add `CLI.OUTPUT_FORMATS.JSON = "json"`

**`src/utils/geminiExecutor.ts`**
- Always push `--output-format json` into args (primary and fallback)
- After CLI output, try `JSON.parse()` to extract `response` and `stats`
- On success: return `response` + stats summary line
- On JSON parse failure: return raw text as-is (graceful fallback)
- On JSON `error` field present: throw with structured error message

### Stats line format

```
[Gemini stats: 1,234 input tokens, 567 output tokens, model: gemini-3.1-pro-preview]
```

### What doesn't change

- `ask-gemini.tool.ts` — no schema or execute changes
- `commandExecutor.ts` — stays generic
- `changeMode` flow — works the same, parses `response` field instead of full output
- MCP response format — still a single text content block

### Error handling

| Scenario | Behavior |
|---|---|
| JSON parse failure | Fall back to raw text, log debug warning |
| JSON has `error` field | Throw with error message |
| Missing `response` field | Fall back to raw text |

### Tests

- Verify `--output-format json` flag is always passed in args
- JSON response parsing with stats appended
- Graceful fallback on non-JSON output
- Error field handling
