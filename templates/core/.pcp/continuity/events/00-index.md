---
doc: continuity/events/00-index.md
type: index
status: living
version: 1.2.0
last_updated: 2026-07-15T17:35:00+06:00
ownership: protocol
---

# Active events

This directory intentionally contains zero event records at clean genesis.

- Each later record is one minimal immutable YAML file named by its monotonic ULID.
- Create it through `pcp record` from a transient external input; do not hand-author an event ID or write directly into this directory.
- The engine records a payload digest. Reported and observed changes also carry a caller-supplied stable `change_key`; duplicate active keys fail without mutation.
- Keep at most 64 active events. When the next event would exceed the limit, move the oldest 32 to `../archive/` before recording it.
- Current state belongs in canonical YAML and numbered Markdown; events carry only reconciliation facts.
- Corrections are later events. Existing active or archived records are never edited.
