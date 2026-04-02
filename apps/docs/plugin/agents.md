# Agents

Agents are specialized sub-processes that Claude Code dispatches to handle complex tasks. Each agent runs in an isolated context window, preventing review noise from polluting your main conversation.

## Review Agents

All review agents use a 3-phase workflow with confidence-based filtering:

**Phase 1: Context Gathering**
- Read the project's `CLAUDE.md` for conventions
- Analyze the git diff (staged + unstaged)
- Identify affected files and their purpose

**Phase 2: Provider Consultation**
- Construct a targeted prompt with the diff and conventions
- Call the respective provider (Gemini, Codex, or Ollama)
- Parse the structured response

**Phase 3: Synthesis**
- Filter findings by confidence score (80%+ threshold)
- Group as **Critical** (90%+) or **Important** (80-89%)
- Discard low-confidence noise

### `gemini-reviewer`

Sends code changes to Google Gemini for review. Leverages Gemini's massive context window for changes that span many files.

### `codex-reviewer`

Sends code changes to OpenAI Codex (GPT-5.4) for review. Automatic fallback to GPT-5.4-mini on quota limits.

### `ollama-reviewer`

Sends code changes to a local Ollama model. All processing stays on your machine — no data leaves your network.

## Brainstorm Agent

### `brainstorm-coordinator`

Orchestrates multi-LLM brainstorming sessions:

1. Receives a topic and list of providers
2. Sends the topic to each provider **in parallel**
3. Collects all responses
4. Synthesizes into a structured report:
   - **Consensus** — Where all providers agree
   - **Unique insights** — Ideas from only one provider
   - **Contradictions** — Where providers disagree
   - **Recommendations** — Actionable next steps

This agent is invoked by the `/brainstorm` and `/brainstorm-all` skills.

## Running Agents Directly

You can also invoke agents directly from Claude Code:

```text
Use the gemini-reviewer agent to review my current changes
```

Or in automated workflows via the Agent tool with `subagent_type`.
