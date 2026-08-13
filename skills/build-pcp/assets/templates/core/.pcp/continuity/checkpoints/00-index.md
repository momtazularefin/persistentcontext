---
doc: continuity/checkpoints/00-index.md
type: index
status: living
version: 1.2.0
last_updated: 2026-08-13T22:20:00+06:00
ownership: protocol
---

# Per-conversation checkpoints

Checkpoint YAML is runtime-owned and normally local-only. One file records which active event one actor execution has absorbed.

- Humans do not require checkpoints.
- Preview with `pcp sync`; preview never writes a checkpoint.
- Advance a checkpoint only after absorbing every returned current path and acknowledging the exact recomputed sync digest.
- Acknowledgement writes only the local checkpoint, targets the newest active event, and creates no continuity event.
- The checkpoint filename, checkpoint ID, and execution ID are the same ULID. Duplicate actor/execution identities are invalid.
- If its event is older than the active window, rebuild the baseline from current canonical documents instead of replaying the archive.
- Archived event filenames may establish the active floor, but normal synchronization never reads archived contents.
