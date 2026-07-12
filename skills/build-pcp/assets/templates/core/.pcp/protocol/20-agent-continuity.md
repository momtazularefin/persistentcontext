---
doc: protocol/20-agent-continuity.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Agent continuity

## Stable identity

- Cache one readable, collision-resistant agent ID for the life of this project.
- On a later task, reuse or recover that ID; do not derive a new ID from the machine on every run.
- A missing matching profile means first registration. An existing matching profile means the agent is returning.
- Keep the durable agent ID separate from per-execution ULIDs.

## Scoped reconciliation

- A returning agent compares its scoped checkpoint with newer immutable events.
- Reconcile events that affect the active workstream, dependency workstreams, overlapping paths, protocol, shared policy, or the project registry.
- An unrelated event in another concurrent scope remains visible but does not trigger a full reread.
- Read the current documents named by relevant events; do not reconstruct current state from event prose alone.
- Advance a checkpoint only after the relevant current state has been absorbed.

## Recording change

- Record one event for a meaningful durable change after canonical state is valid.
- Attribute human, agent, and system origin explicitly.
- Do not journal routine inspection, registration, synchronization, no-op rendering, or adoption.
- Never edit an existing event; record a later corrective event when needed.

## Parallel work

- Declare path and semantic scope in `state/workstreams.yaml` before concurrent mutation.
- Treat dependency, shared-policy, protocol, registry, and overlapping-path changes as cross-scope signals.
- Reconcile completion evidence before a dependent workstream is completed.
