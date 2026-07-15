---
doc: templates/40-workstream.md
type: plan
status: static
version: 1.1.0
last_updated: 2026-07-15T11:20:00Z
ownership: project
---

# Workstream scaffold

This Markdown scaffold supplements, but never replaces, the canonical entry in `../state/workstreams.yaml`.

- Workstream ID: `[stable slug]`
- Name: `[human-readable name]`
- Kind: `[sequential | concurrent | ceb]`
- Status: `[planned | active | blocked | complete | cancelled]`
- Paths: `[owned relative paths]`
- Areas: `[semantic scope slugs]`
- Dependencies: `[workstream IDs]`
- Completion criteria: `[observable conditions]`
- Evidence: `[one criterion-to-proof mapping per completion criterion]`
- Completion announcement: `[what downstream work may now do]`

Use this document for discussion only. Apply lifecycle changes through the digest-bound `pcp workstream` commands so the registry, generated view, and continuity event remain atomic.
