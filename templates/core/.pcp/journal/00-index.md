---
doc: journal/00-index.md
type: index
status: living
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Reconciliation journal

The journal records meaningful durable changes after adoption. It is not a transcript or a full event-sourced database.

- Adoption, migration, registration, inspection, and no-op rendering create no event.
- Each event is one immutable YAML file under [events/00-index.md](events/00-index.md).
- Current state belongs in canonical YAML and numbered Markdown; events explain relevant change and rationale.
- A returning agent reads only newer events relevant to its scope and dependencies.
