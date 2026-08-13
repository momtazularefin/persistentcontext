---
doc: 00-index.md
type: index
status: living
version: 2.0.0
last_updated: 2026-08-13T21:20:38+06:00
ownership: protocol
---

# Persistent Context Protocol

This is the canonical project context entry point. Root convention files are thin adapters that route agents here.

## Every user request

1. Follow the generated platform adapter before answering or using project tools.
2. Reuse this project's durable actor ID and this conversation's execution ID. Register once when either is unavailable.
3. Run `node .pcp/tools/pcp.mjs sync . --actor-id <actor-id> --execution-id <execution-id>`.
4. If nothing changed, continue immediately. Otherwise read every returned current path and acknowledge the exact sync digest after absorbing it.
5. Synchronization is global: every newer continuity event is delivered. Work labels, scopes, paths, and inferred dependencies never suppress an update.
6. Read only the additional knowledge, operations, project, and state documents needed for the active task.

## Guided reading order

1. [Protocol](protocol/00-index.md) — PCP-owned operating rules.
2. [State](state/00-index.md) — machine-readable project, registry, work-label, and VCS authority.
3. [Knowledge](knowledge/00-index.md) — grounded project understanding.
4. [Operations](operations/00-index.md) — living agreements, plan, and decisions.
5. [Projects](projects/00-index.md) — managed project records.
6. [Continuity](continuity/00-index.md) — actor identity, bounded active events, archive, and per-conversation checkpoints.
7. [Views](views/00-index.md), [references](references/00-index.md), and [templates](templates/00-index.md) — projections and reusable guidance.
8. [Schemas](schemas/00-index.md) and [tools](tools/00-index.md) — local protocol validation and execution.

The repository is authoritative. Private memory may accelerate work but cannot replace durable current state.
