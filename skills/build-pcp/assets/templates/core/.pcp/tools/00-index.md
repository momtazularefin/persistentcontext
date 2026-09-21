---
doc: tools/00-index.md
type: index
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Project-local PCP tools

Use the project-local engine so validation, rendering, planning, and lifecycle behavior stay reproducible across machines and supported agent platforms.

- [pcp.mjs](pcp.mjs) — self-contained deterministic engine installed with this protocol version.
- [pcp.sha256](pcp.sha256) — exact SHA-256 identity of the adjacent engine.

Never edit either file. Both are release-owned, and changing the engine and regenerating its checksum makes this installation an unrecorded fork that local verification cannot detect and that still reports its release version. When validation blocks legitimate work, fix the reported records, or change the protocol in PCP source and release it. An upgrade replaces both files with verified release bytes.
