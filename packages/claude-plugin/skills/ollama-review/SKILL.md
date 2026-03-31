---
name: ollama-review
description: Get a second opinion from a local Ollama LLM on your current code changes. Analyzes staged/unstaged diffs and returns prioritized findings. No API keys needed.
user_invocable: true
---

# Ollama Code Review

Review current code changes by delegating to the `ollama-reviewer` agent.

## Instructions

1. Gather the diff to review:
   - Run `git diff` to get unstaged changes
   - Run `git diff --cached` to get staged changes
   - Combine both into a single diff

2. If the diff is empty, inform the user there are no changes to review.

3. Launch the `ollama-reviewer` agent with the diff content. The agent handles the Ollama prompt structure and output formatting.
