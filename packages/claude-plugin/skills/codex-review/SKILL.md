---
name: codex-review
description: Get a second opinion from OpenAI Codex on your current code changes. Analyzes staged/unstaged diffs and returns prioritized findings.
user_invocable: true
---

# Codex Code Review

Review current code changes by delegating to the `codex-reviewer` agent.

## Instructions

1. Gather the diff to review:
   - Run `git diff` to get unstaged changes
   - Run `git diff --cached` to get staged changes
   - Combine both into a single diff

2. If the diff is empty, inform the user there are no changes to review.

3. Launch the `codex-reviewer` agent with the diff content. The agent handles the Codex prompt structure and output formatting.
