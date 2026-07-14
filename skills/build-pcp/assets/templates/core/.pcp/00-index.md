---
doc: 00-index.md
type: index
status: living
version: 1.0.0
last_updated: 2026-07-14T07:20:00Z
ownership: protocol
---

# Persistent Context Protocol

This is the canonical project context entry point. Root convention files are thin adapters that route agents here.

## First task in this project

1. Read `pcp.yaml` and [protocol/00-index.md](protocol/00-index.md).
2. Read [state/00-index.md](state/00-index.md), then the project and workstream records relevant to the task.
3. If no durable actor profile exists for your cached ID, register once. Adoption itself creates no profile and no event.
4. Read only the knowledge, operations, and project documents needed for the active scope.

## Returning task

1. Reuse the cached project-lifetime actor ID; do not recalculate it.
2. Compare the scoped checkpoint with newer active events.
3. Reconcile events that touch the active workstream, its dependencies, overlapping paths, shared policy, protocol, or project registry.
4. Do not reread unchanged material or unrelated concurrent work.

## Guided reading order

1. [Protocol](protocol/00-index.md) — PCP-owned operating rules.
2. [State](state/00-index.md) — machine-readable project, registry, workstream, and VCS authority.
3. [Knowledge](knowledge/00-index.md) — grounded project understanding.
4. [Operations](operations/00-index.md) — living agreements, plan, and decisions.
5. [Projects](projects/00-index.md) — managed project records.
6. [Continuity](continuity/00-index.md) — actor identity, bounded active events, archive, and scoped checkpoints.
7. [Views](views/00-index.md), [references](references/00-index.md), and [templates](templates/00-index.md) — projections and reusable guidance.
8. [Schemas](schemas/00-index.md) and [tools](tools/00-index.md) — local protocol validation and execution.

The repository is authoritative. Private memory may accelerate work but cannot replace durable current state.
