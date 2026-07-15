---
doc: continuity/checkpoints/00-index.md
type: index
status: living
version: 1.0.0
last_updated: 2026-07-14T07:20:00Z
ownership: protocol
---

# Scoped checkpoints

Checkpoint YAML is runtime-owned and normally local-only. It records which active event an agent has reconciled for one scope.

- Humans do not require checkpoints.
- Advance a checkpoint only after absorbing the relevant canonical state.
- If its event is older than the active window, rebuild the affected baseline from current canonical documents instead of replaying the archive.
