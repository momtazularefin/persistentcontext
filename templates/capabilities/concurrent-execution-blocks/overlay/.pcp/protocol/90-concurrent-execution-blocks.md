---
doc: protocol/90-concurrent-execution-blocks.md
type: protocol
status: static
version: 1.1.0
last_updated: 2026-07-15T11:20:00Z
ownership: protocol
---

# Concurrent Execution Blocks

A Concurrent Execution Block (CEB) is an opt-in human-readable operating model over the core workstream protocol. It uses `kind: ceb` in `state/workstreams.yaml`; it does not introduce separate state or commands.

- Give each CEB a stable workstream ID, bounded paths and semantic areas, dependencies, completion criteria, and status.
- Run blocks concurrently only when their write scopes do not overlap and their dependency graph permits it.
- Shared protocol, policy, project-registry, dependency, and overlapping-path changes are relevant to every affected block.
- An agent reconciles newer events for its block and dependencies; unrelated blocks do not force full startup replay.
- Complete a block through `pcp workstream complete`, with one proof per criterion and a concise announcement for dependent work.
- External or human-owned work remains an explicit dependency rather than being silently marked complete.
