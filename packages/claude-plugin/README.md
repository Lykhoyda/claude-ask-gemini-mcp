# @ask-llm/plugin

<div align="center">

**Claude Code plugin for AI-to-AI collaboration**

</div>

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that adds multi-provider code review, brainstorming, and automated hooks. Get second opinions from Gemini, Codex, and Ollama without leaving Claude Code.

Part of the [Ask LLM](https://github.com/Lykhoyda/ask-llm) monorepo.

## Installation

### From Marketplace

```
/plugin marketplace add Lykhoyda/ask-llm
/plugin install ask-llm@ask-llm-plugins
```

### MCP Servers (user scope for short tool names)

```bash
claude mcp add --scope user gemini -- npx -y ask-gemini-mcp
claude mcp add --scope user codex -- npx -y ask-codex-mcp
claude mcp add --scope user ollama -- npx -y ask-ollama-mcp
```

## Skills

| Command | Description |
|---------|-------------|
| `/multi-review` | Parallel Gemini + Codex review with 4-phase validation pipeline and consensus highlighting |
| `/gemini-review` | Gemini-only code review with confidence filtering |
| `/codex-review` | Codex-only code review (precision-first, ≥80 confidence — default for routine PR review) |
| `/codex-pair` | **Recall-first** continuous review via PostToolUse hook — opt-in per project via `.codex-pair-context.md` marker file. Complement to `/codex-review` for money/security/spec-implementing code (see [ADR-077](../../docs/DECISIONS.md)) |
| `/ollama-review` | Local review — no data leaves your machine |
| `/brainstorm` | Multi-LLM brainstorm with Claude Opus as a first-class research participant (default external: gemini,codex) |
| `/brainstorm-all` | Brainstorm with all three external providers + Claude Opus research |
| `/compare` | Side-by-side raw responses from multiple providers (no synthesis, no consensus extraction) |

## Agents

| Agent | Color | Description |
|-------|-------|-------------|
| gemini-reviewer | cyan | 4-phase: context, prompt, synthesis, validation |
| codex-reviewer | green | 4-phase: context, prompt, synthesis, validation |
| ollama-reviewer | yellow | 4-phase: context, prompt, synthesis, validation (local) |
| brainstorm-coordinator | magenta | Claude Opus research + parallel multi-LLM consultation with synthesis; verified findings weighted higher than inferred |

## Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| PreToolUse | Before `git commit` | Reviews staged changes via Gemini, warns about critical issues |
| PostToolUse | After Edit/Write/MultiEdit | Runs codex-pair review IF `.codex-pair-context.md` marker file is present in the project (opt-in, ADR-077) |

## Enabling codex-pair mode

The `codex-pair` hook is loaded by default but **self-gates on a marker file**. Without the marker, every edit triggers one `fs.access()` call and exits — zero codex calls, zero cost.

To enable for a project:

```bash
cat > .codex-pair-context.md <<'EOF'
# .codex-pair-context.md

This is a payment-processing service. Currency must use integer cents
(floats lose precision on every charge). Concurrent requests are real.
URL inputs are untrusted.

[Add deployment shape, stated requirements, or threat surface the
reviewer should know.]
EOF
```

Once present, every Edit/Write/MultiEdit triggers a Codex review of the file with the marker's content as project context. HIGH and MED concerns appear to Claude as system reminders on the next turn; LOW concerns are logged to `.codex-pair-log.jsonl` but suppressed from surfacing.

To disable:

| Goal | Mechanism |
|---|---|
| Permanently for this project | `rm .codex-pair-context.md` |
| Just this session | `/plugin disable ask-llm` |
| Just this command | `CODEX_PAIR_DISABLED=1 <command>` |

**Cost characteristics**: ~$0.04–0.07 per file reviewed (gpt-5.5), ~13–50s per file. Files >20KB skipped (override with `CODEX_PAIR_MAX_FILE_BYTES`). node_modules/dist/lockfiles/images skipped automatically.

**When to enable**: money handling, security-sensitive paths, code implementing a written spec, concurrent state management. **When NOT to enable**: routine refactors, glue code, simple CRUD — `/codex-review` is sufficient at 1/4 the cost. The four-task benchmark in ADR-077 has the full evidence trail.

## Requirements

- **Claude Code** installed
- **Gemini CLI** authenticated — required for hooks and Gemini features
- **Codex CLI** — required for `/codex-review` and brainstorm with Codex
- **Ollama** running locally — required for `/ollama-review`

## Documentation

Full docs at [lykhoyda.github.io/ask-llm/plugin/overview](https://lykhoyda.github.io/ask-llm/plugin/overview)

## License

MIT
