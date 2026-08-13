---
doc: protocol/70-workstreams.md
type: protocol
status: static
version: 2.0.0
last_updated: 2026-08-13T21:20:38+06:00
ownership: protocol
---

# Work labels

`state/workstreams.yaml` is an optional registry of descriptive work labels. It can communicate current lifecycle state, relevant areas and paths, and observable completion evidence. It is not a scheduler, dependency graph, ownership lock, or synchronization filter.

## Safe operation

1. Run `pcp workstream validate` and bind a proposed mutation to the returned registry digest.
2. Keep transient mutation input outside the managed project.
3. Use `create` or `update` with one complete record. Use `complete` only with exactly one proof per declared criterion and a human-readable announcement.
4. Let the engine replace the registry, regenerate its status view, and append the attributed event under one continuity lock.

New labels may start as `planned`, `active`, or `blocked`. `planned`, `active`, and `blocked` may move through their permitted lifecycle or become `cancelled`; only `complete` supplies completion evidence. `complete` and `cancelled` are terminal.

Use `sequential` or `concurrent` as descriptive kinds. PCP does not infer independence from either value. Missing or inaccurate label metadata cannot hide continuity updates because `sync` always returns every newer event.
