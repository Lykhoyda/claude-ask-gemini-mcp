---
name: codex-pair-resume
description: Resume the codex-pair PostToolUse hook for this project after a previous /codex-pair-pause. Removes the .codex-pair-state/paused sentinel. The hook starts reviewing edits again on the next Edit/Write/MultiEdit. No-op if no pause sentinel exists.
user_invocable: true
---

# Resume codex-pair for this project

Removes the pause sentinel written by `/codex-pair-pause`, restoring normal codex-pair review behavior. The `.codex-pair-context.md` marker and `.codex-pair-state/` directory are left in place (the directory may hold future state).

## Instructions

1. Locate the `.codex-pair-context.md` marker by walking up from the current working directory. If no marker is found, inform the user: "codex-pair is not enabled in this project (no `.codex-pair-context.md` marker found). Nothing to resume."

2. Check whether the pause sentinel exists at `<marker-dir>/.codex-pair-state/paused`:
   - If it does not exist, tell the user: "codex-pair was not paused — no `.codex-pair-state/paused` sentinel found. No change."
   - If it exists, remove it:
     ```bash
     rm <marker-dir>/.codex-pair-state/paused
     ```

3. Confirm to the user with the marker directory path:
   ```
   codex-pair resumed for <marker-dir>
   The next Edit/Write/MultiEdit will trigger a review.
   ```
