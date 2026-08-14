---
doc: protocol/00-index.md
type: index
status: static
version: 2.1.0
last_updated: 2026-08-15T02:38:23+06:00
ownership: protocol
---

# Protocol reading order

Read only as much as the current operation requires:

1. [10-context-contract.md](10-context-contract.md) — authority, ownership, and clean genesis.
2. [20-actor-continuity.md](20-actor-continuity.md) — stable actor identity, per-conversation synchronization, and bounded history.
3. [30-exploration.md](30-exploration.md) — project-neutral three-state discovery.
4. [40-documentation.md](40-documentation.md) — numbered documents, metadata, and discoverability.
5. [50-portability-and-safety.md](50-portability-and-safety.md) — path, privacy, and mutation boundaries.
6. [60-version-control.md](60-version-control.md) — configurable Git responsibility and the reference flow.
7. [70-workstreams.md](70-workstreams.md) — optional work labels, evidence, and atomic lifecycle updates.
8. [120-updates-and-reset.md](120-updates-and-reset.md) — canonical-source update discovery, ownership-aware upgrades, semantic review, and optional history purge.

Optional capabilities add later numbered protocol documents and update this index when installed.
