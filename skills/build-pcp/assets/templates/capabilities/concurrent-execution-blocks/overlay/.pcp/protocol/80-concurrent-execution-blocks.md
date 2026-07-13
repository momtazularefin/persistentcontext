---
doc: protocol/80-concurrent-execution-blocks.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Concurrent Execution Blocks

A Concurrent Execution Block (CEB) is an opt-in human-readable operating model over `state/workstreams.yaml`.

- Give each CEB a stable workstream ID, bounded paths and semantic areas, dependencies, completion criteria, and status.
- Run blocks concurrently only when their write scopes do not overlap and their dependency graph permits it.
- Shared protocol, policy, project-registry, dependency, and overlapping-path changes are relevant to every affected block.
- An agent reconciles newer events for its block and dependencies; unrelated blocks do not force full startup replay.
- A block is complete only when its criteria have evidence and every dependent consumer has the information needed to continue.
- External or human-owned work remains an explicit dependency rather than being silently marked complete.
