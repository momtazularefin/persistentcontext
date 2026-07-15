---
doc: protocol/70-workstreams.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-15T11:20:00Z
ownership: protocol
---

# Workstreams

`state/workstreams.yaml` is the canonical registry for bounded work, dependencies, lifecycle state, and completion evidence. Generated views describe this state but never replace it.

## Safe operation

1. Run `pcp workstream validate` and bind each proposed mutation to the returned registry digest.
2. Keep transient mutation input outside the managed project.
3. Use `create` or `update` with a complete workstream record. Do not patch fields implicitly.
4. Use `complete` only with exactly one proof for every declared criterion and a human-readable completion announcement.
5. Let the engine replace the registry, regenerate its status view, and append the attributed workstream event under one continuity lock.

A stale digest, invalid actor attribution, unsafe input, dependency conflict, or failed live validation rejects the operation without accepted mutation. A caught transactional failure restores the exact registry, generated view, and active/archive history preimages.

## Lifecycle

- New work starts as `planned`, `active`, or `blocked`.
- `planned` may become `active`, `blocked`, or `cancelled`.
- `active` and `blocked` may move between each other or become `cancelled`.
- Only `complete` may set the `complete` state.
- `complete` and `cancelled` are terminal.
- A workstream cannot complete until every dependency is complete.

Use `sequential` or `concurrent` as descriptive kinds. The optional Concurrent Execution Block capability adds human coordination guidance for `ceb` workstreams; it does not create a second registry or lifecycle.
