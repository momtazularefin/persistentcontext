---
doc: continuity/checkpoints/00-index.md
type: index
status: living
version: 1.1.0
last_updated: 2026-07-15T08:53:00Z
ownership: protocol
---

# Scoped checkpoints

Checkpoint YAML is runtime-owned and normally local-only. One file records which active event an agent has reconciled for an exact workstream, dependency, semantic-scope, and path selection.

- Humans do not require checkpoints.
- Preview with `pcp status`; preview never writes a checkpoint.
- Advance a checkpoint only after absorbing the relevant canonical state and acknowledging the exact recomputed status digest.
- Acknowledgement writes only the local checkpoint, targets the newest active event, and creates no continuity event.
- Duplicate files for the same actor and normalized scope are invalid and must not be guessed between.
- If its event is older than the active window, rebuild the affected baseline from current canonical documents instead of replaying the archive.
- Archived event filenames may establish the active floor, but normal reconciliation never reads archived contents.
