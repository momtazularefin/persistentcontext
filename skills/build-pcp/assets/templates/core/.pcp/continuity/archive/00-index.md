---
doc: continuity/archive/00-index.md
type: index
status: living
version: 1.1.0
last_updated: 2026-07-15T08:53:00Z
ownership: protocol
---

# Event archive

This directory starts empty and holds immutable events compacted out of the active window.

- Archive entries exist only for historical audit and recovery.
- Registration and ordinary reconciliation may inspect entry filenames only to validate event identities and detect the active-event floor. They never read archived entry contents.
- Read archived events only when a human explicitly requests history or when a scoped audit or recovery cannot be completed from current canonical state.
- Event ULIDs continue unchanged across active and archived history; no sequence restarts.
