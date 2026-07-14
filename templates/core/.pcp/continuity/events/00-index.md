---
doc: continuity/events/00-index.md
type: index
status: living
version: 1.0.0
last_updated: 2026-07-14T07:20:00Z
ownership: protocol
---

# Active events

This directory intentionally contains zero event records at clean genesis.

- Each later record is one minimal immutable YAML file named by its monotonic ULID.
- Keep at most 64 active events. When the next event would exceed the limit, move the oldest 32 to `../archive/` before recording it.
- Current state belongs in canonical YAML and numbered Markdown; events carry only reconciliation facts.
- Corrections are later events. Existing active or archived records are never edited.
