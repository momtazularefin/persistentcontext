---
doc: continuity/archive/00-index.md
type: index
status: living
version: 1.3.0
last_updated: 2026-08-13T22:20:00+06:00
ownership: protocol
---

# Event archive

This directory starts empty and holds immutable events compacted out of the active window.

- Archive entries exist only for historical audit and recovery.
- Registration and ordinary synchronization may inspect entry filenames only to validate event identities and detect the active-event floor. They never read archived entry contents.
- Read archived events only when a human explicitly requests history or when an audit or recovery cannot be completed from current canonical state.
- A full archive audit verifies event payload digests and duplicate change keys. Filename-only operational validation deliberately does neither.
- The audit checks archived events for schema, integrity, and secrets, but not for portability. Every event is checked for portability in full while it is active, and archived records are immutable, so an archived portability failure could never be corrected. Never edit an archived record or the engine to make validation pass.
- Event ULIDs continue unchanged across active and archived history; no sequence restarts.
