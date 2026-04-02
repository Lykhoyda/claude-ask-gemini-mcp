---
name: multi-review
description: This skill should be used when the user asks to "review my code with multiple providers", "get reviews from Gemini and Codex", "multi-provider review", "review changes", or wants independent code reviews from both Gemini and Codex in parallel.
user_invocable: true
---

# Multi-Provider Code Review

Run independent code reviews from Gemini and Codex in parallel, then present combined findings.

## Instructions

1. Gather the diff to review:
   - Run `git diff` to get unstaged changes
   - Run `git diff --cached` to get staged changes
   - Combine both into a single diff

2. If the diff is empty, inform the user there are no changes to review.

3. Launch both agents **in parallel** using the Agent tool in a single message:
   - `gemini-reviewer` agent with the diff content
   - `codex-reviewer` agent with the diff content

4. Once both agents complete, present a combined summary:
   - List findings from each provider under its own heading
   - Highlight any issues flagged by **both** providers (high-confidence consensus)
   - Note any contradictions where providers disagree
