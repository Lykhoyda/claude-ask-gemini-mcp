---
name: brainstorm-all
description: Send a topic to ALL LLM providers (Gemini, Codex, Ollama) in parallel. Shortcut for /brainstorm gemini,codex,ollama <topic>. Requires Ollama to be running locally.
user_invocable: true
---

# Multi-LLM Brainstorm (All Providers)

Consult all available LLM providers (Gemini, Codex, Ollama) simultaneously and synthesize their perspectives.

## Instructions

1. Determine the brainstorm topic:
   - If the user provided a topic directly, use it
   - If the context is about code changes, gather the relevant diff with `git diff` and `git diff --cached`
   - If the context is a design/plan, gather the relevant documentation or conversation context

2. If no topic is clear, ask the user what they'd like to brainstorm about.

3. Launch the `brainstorm-coordinator` agent with the topic, providers set to `gemini,codex,ollama`, and any gathered context.
