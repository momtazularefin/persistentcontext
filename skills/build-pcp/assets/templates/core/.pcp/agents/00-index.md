---
doc: agents/00-index.md
type: index
status: living
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Agent profiles

This folder starts with zero profiles. Registration creates one YAML profile only when an agent first works on the adopted project.

- Reuse a cached stable agent ID for the life of the project.
- Recover an existing matching profile before creating a new one.
- Keep execution IDs separate from durable agent IDs.
- Store no credentials, private platform identifiers, or conversation transcripts.
- Reconcile through scoped checkpoints; do not replay the full journal before every task.
