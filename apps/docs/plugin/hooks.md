# Hooks

Hooks are automated actions that trigger on specific Claude Code events. The plugin configures two hooks that provide passive, advisory code review via Gemini without any manual invocation.

## Stop Hook (Worktree Review)

**Trigger:** When a Claude Code session ends.

**Action:** Sends the current worktree diff to Gemini for a quick advisory review.

**What it does:**
1. Runs `git diff HEAD` to capture tracked changes in the worktree
2. Truncates input to 50KB to stay within token limits
3. Filters out sensitive files (secrets, keys, lock files)
4. Pipes the filtered diff to `ask-gemini-run`
5. Returns a concise 3-bullet review of critical issues

> This reviews tracked worktree changes at the time the session ends, not a session-scoped diff. Untracked files are not included.

## Pre-Commit Hook

**Trigger:** Before any `git commit` command runs via Bash.

**Action:** Reviews staged changes and warns about critical issues. This is **advisory only** — it does not block the commit.

**What it does:**
1. Detects when a Bash command contains `git commit`
2. Runs `git diff --staged` to capture what's about to be committed
3. Filters out sensitive files
4. Pipes to `ask-gemini-run` for a quick review
5. Outputs warnings to stderr, then exits successfully

> The hook always exits 0. It warns about issues but does not prevent the commit from proceeding.

## Provider

Both hooks are hardcoded to use Gemini via the `ask-gemini-run` binary. To use a different provider, you would need to edit `hooks/hooks.json` and change the binary (e.g., `ask-codex-run` or `ask-ollama-run`).

## CLI Binaries

The hooks use CLI binaries that you can also call directly:

```bash
# Pipe a diff to Gemini
git diff | ask-gemini-run "Review these changes for critical issues"

# Pipe to Codex
git diff --staged | ask-codex-run "Any bugs in these staged changes?"

# Pipe to local Ollama
cat src/auth.ts | ask-ollama-run "Review this auth implementation"
```

All three binaries accept:
- **Positional argument:** The prompt
- **Stdin:** Piped content (code, diffs, files)
- **Combined:** `echo 'code' | ask-gemini-run "review this"`
