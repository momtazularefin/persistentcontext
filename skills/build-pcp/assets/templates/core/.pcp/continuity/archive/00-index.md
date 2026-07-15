---
doc: continuity/archive/00-index.md
type: index
status: living
version: 1.2.0
last_updated: 2026-07-15T17:35:00+06:00
ownership: protocol
---

# Event archive

This directory starts empty and holds immutable events compacted out of the active window.

- Archive entries exist only for historical audit and recovery.
- Registration and ordinary reconciliation may inspect entry filenames only to validate event identities and detect the active-event floor. They never read archived entry contents.
- Read archived events only when a human explicitly requests history or when a scoped audit or recovery cannot be completed from current canonical state.
- A full archive audit verifies event payload digests and duplicate change keys. Filename-only operational validation deliberately does neither.
- Event ULIDs continue unchanged across active and archived history; no sequence restarts.
