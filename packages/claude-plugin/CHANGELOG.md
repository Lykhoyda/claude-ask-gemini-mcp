# @ask-llm/plugin

## 0.5.0

### Minor Changes

- codex-pair hook now emits a `systemMessage` notice to Claude Code on every run — `OK` when no concerns are found, `WARN` with HIGH/MED bodies when concerns surface, and `SKIP`/`ERROR` when the hook attempts work but can't complete (unreadable file, oversize file, codex timeout). Previously the hook was silent on the happy path, so review activity was only visible in `.codex-pair-log.jsonl`. The threshold-in-hook design from ADR-077 is preserved: LOW concern bodies still go to the log only, with a count surfaced in the verdict header.
