# Skills

Skills are slash commands you can invoke directly in Claude Code. Each skill triggers a structured workflow that gathers context, calls a provider, and returns prioritized findings.

> `/gemini-review` works out of the box with the plugin. `/codex-review` and `/ollama-review` require their MCP servers to be added separately — see [Plugin Overview](/plugin/overview#installation).

## Review Skills

All three review skills follow the same pattern:

1. Gather staged and unstaged git changes
2. Read project conventions from `CLAUDE.md`
3. Send the diff + context to the provider
4. Return findings filtered by confidence (80%+ threshold)
5. Group results: **Critical** (90%+) vs **Important** (80-89%)

### `/gemini-review`

Get a second opinion from Google Gemini on your current code changes.

```text
/gemini-review
```

Uses Gemini's 1M+ token context window, making it ideal for reviewing changes that touch many files or require understanding a large codebase.

### `/codex-review`

Get a second opinion from OpenAI Codex (GPT-5.4) on your current changes.

```text
/codex-review
```

Falls back to GPT-5.4-mini automatically if you hit quota limits.

### `/ollama-review`

Get a second opinion from a local Ollama model. No API keys needed — all processing stays on your machine.

```text
/ollama-review
```

Requires Ollama running locally with a model pulled (e.g., `qwen2.5-coder:7b`).

## Brainstorm Skills

### `/brainstorm`

Send a topic to multiple LLM providers in parallel and get synthesized analysis. The coordinator agent sends your topic to each provider, then synthesizes the responses into:

- Consensus points (where providers agree)
- Unique insights (ideas from only one provider)
- Contradictions (where providers disagree)
- Actionable recommendations

```text
# Default providers (Gemini + Codex)
/brainstorm Should we use a monorepo or polyrepo for this project?

# Custom providers
/brainstorm gemini,codex,ollama Review this authentication approach
```

**Default providers:** `gemini,codex` (avoids unnecessary Ollama calls if not needed).

### `/brainstorm-all`

Shortcut for `/brainstorm gemini,codex,ollama <topic>`. Sends to all three providers including Ollama.

```text
/brainstorm-all What's the best caching strategy for our API?
```

Requires Ollama running locally since it includes the local provider.
