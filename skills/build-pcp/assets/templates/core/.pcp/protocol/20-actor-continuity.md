---
doc: protocol/20-actor-continuity.md
type: protocol
status: static
version: 1.2.0
last_updated: 2026-07-15T08:53:00Z
ownership: protocol
---

# Actor continuity

## Stable identity

- Create an ID once as `<actor-label>-<machine-label>-<10-character-Crockford-suffix>`, all kebab-case before the uppercase suffix. Use the agent client as its actor label or `human` for a human; generate the suffix once rather than deriving a shared counter.
- Cache that readable, collision-resistant actor ID under ignored `.pcp/runtime/actors/` for the life of this project.
- Agents reuse or recover their ID on later tasks; they do not derive a new ID on every run.
- A missing matching profile means first registration. An existing matching profile means the actor is returning.
- When the local cache is missing, recover one matching durable profile. Require an explicit actor ID when multiple profiles match, and fail closed when a cache is stale or contradictory.
- Humans use the same ID pattern as agents. The first informed agent may register a human when recording a reported or observed human action.
- Invoke registration once per execution. Keep the returned execution ULID and later event ULIDs separate from the durable actor ID.
- Registration is an operational action and never creates a continuity event.
- Normal registration validates archived event identities by filename only. It does not read archived event contents.

## Scoped reconciliation

- A returning agent runs `pcp status` with its stable actor ID and the current workstream, semantic scopes, or project paths. The exact normalized selection identifies one local checkpoint.
- The engine expands the selected workstream through transitive dependencies, then compares that scoped checkpoint with newer active events.
- Reconcile events that affect the active workstream, dependency workstreams, overlapping paths, protocol, shared policy, project state, or the project and workstream registries.
- An unrelated event in another concurrent scope remains visible but does not trigger a full reread.
- Read the current documents named by relevant events; do not reconstruct current state from event prose alone.
- The default status operation is read-only. It reports the relevant and out-of-scope changes, required current paths, and a digest bound to the complete observed status.
- Advance a checkpoint only after the relevant current state has been absorbed by rerunning status with `--acknowledge <status-digest>`. The engine recomputes the same view under the continuity lock and refuses a stale or incorrect digest.
- A successful acknowledgement advances the scoped checkpoint to the newest active event, including visible out-of-scope events, so already-seen changes do not repeat. It changes no project document and creates no continuity event.
- If the checkpoint is already current, acknowledgement is unnecessary and a matching explicit acknowledgement is a no-op.
- If a checkpoint predates the active-event floor, rebuild only the affected scope from canonical current state. Do not replay the archive as routine startup work.
- Normal status may inspect archive filenames to detect that floor. It never reads archived event contents.

## Recording change

- Record one minimal event for a meaningful durable change after canonical state is valid.
- Record who performed the action, who recorded it, and whether it was self-recorded, reported, observed, or system-generated.
- When a human reports a change or VCS operation, record the report without claiming independent verification. If later evidence disagrees, notify the human and record the correction.
- The first agent that notices an unrecorded durable human change records it; do not duplicate an existing event.
- Do not record routine inspection, registration, synchronization, no-op rendering, or adoption.
- Never edit an existing event; record a later corrective event when needed.

## Bounded active history

- Keep at most 64 events in `continuity/events/`.
- When an addition would exceed 64, move the oldest 32 immutable events to `continuity/archive/` in one maintenance operation.
- Event ULIDs remain globally unique and monotonic across active and archived history. No shared sequential counter is used.
- Agents do not read archived events during normal work. Archive content access requires an explicit audit, recovery, or historical request; operational validation uses archive-index-only mode.

## Parallel work

- Declare path and semantic scope in `state/workstreams.yaml` before concurrent mutation.
- Treat dependency, shared-policy, protocol, registry, and overlapping-path changes as cross-scope signals.
- Reconcile completion evidence before a dependent workstream is completed.
