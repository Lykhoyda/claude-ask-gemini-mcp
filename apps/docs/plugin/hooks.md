# Hooks

Hooks are automated actions that trigger on specific Claude Code events. The plugin configures one hook that provides passive, advisory code review via Gemini without any manual invocation.

> The plugin previously shipped a `Stop` hook that reviewed worktree changes when a Claude Code session ended. It was removed in [ADR-048](https://github.com/Lykhoyda/ask-llm/blob/main/docs/DECISIONS.md) because the `Stop` event fires per-turn rather than per-session, making it noisy and high-latency, and `git diff HEAD` excluded untracked files which silently dropped coverage on new-file sessions. Use the `/gemini-review` slash command for explicit on-demand reviews instead.

## Pre-Commit Hook

**Trigger:** Before any `git commit` command runs via Bash.

**Action:** Reviews staged changes and warns about critical issues. This is **advisory only** — it does not block the commit.

**What it does:**
1. Detects when a Bash command contains `git commit` (a `PreToolUse` matcher on the `Bash` tool)
2. Runs `git diff --cached` to capture what's about to be committed
3. Filters out sensitive files (secrets, keys, lock files)
4. Truncates input to 50KB to stay within token limits
5. Pipes the filtered diff to `gemini -p @tempfile` for a quick review
6. Outputs warnings to stderr, then exits successfully

> The hook always exits 0. It warns about issues but does not prevent the commit from proceeding. A `trap` ensures the temp file is cleaned up even on signal interruption (ADR-040).

## Provider

The pre-commit hook is hardcoded to use Gemini via the `gemini` CLI directly. To use a different provider, you would need to edit `packages/claude-plugin/scripts/pre-commit-review.sh` and replace the `gemini -p` invocation with `codex exec --full-auto` or `ollama run`.

## CLI Binaries

The plugin also ships CLI binaries you can call directly from your shell — useful for piping diffs into a provider outside of any hook:

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
