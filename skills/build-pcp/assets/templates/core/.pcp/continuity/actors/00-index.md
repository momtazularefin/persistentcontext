---
doc: continuity/actors/00-index.md
type: index
status: living
version: 1.0.0
last_updated: 2026-07-14T07:20:00Z
ownership: protocol
---

# Actor profiles

This folder starts with zero profiles. Registration creates a minimal YAML profile only when a human or agent first needs durable attribution in the adopted project.

- Reuse a cached stable actor ID for the life of the project.
- New IDs use `<app>-<normalized-hostname>-<10-character-Crockford-suffix>`. Known app labels are `antigravity`, `codex`, `claude`, `copilot`, and `cursor`; humans use `human`, and an otherwise unknown app chooses one lowercase word.
- Registration derives the machine component from the local `hostname` value. Do not supply a descriptive machine alias.
- Recover an existing matching profile before creating a new one.
- Preserve legacy durable IDs exactly; compatibility recovery must not rename them.
- A human profile may be created by the first agent recording a reported or observed human action.
- Keep execution and event IDs separate from durable actor IDs.
- Store no credentials, private platform identifiers, or conversation transcripts.
