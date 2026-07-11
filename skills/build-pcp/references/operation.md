# Ongoing Operation

## Registration and reconciliation

- Register an agent on its first real task after adoption.
- Recover a cached stable identity when one exists; do not silently recalculate it.
- Keep execution IDs separate from agent identity.
- Compare scoped checkpoints with newer journal ULIDs.
- Load changes relevant to the active workstream, dependencies, shared policies, project registry, or overlapping paths.
- Advance a checkpoint only after referenced canonical state has been absorbed.

Registration, status checks, and unchanged rendering are operational actions, not journal events.

## Meaningful changes

Record one immutable event for a durable project change. Include actor, origin, kind, affected scope, summary, rationale, and affected paths. Never edit an existing event; add a corrective event and update canonical state when correction is needed.

## Rendering

Render human views and platform adapters from canonical state. Treat a digest mismatch as stale generated output. Do not make generated Markdown an independent source of truth.

## Workstreams and CEBs

Use generic workstream state for scope, dependencies, status, and completion evidence. Enable the Concurrent Execution Block capability when the project wants named parallel blocks. Complete a block only after detecting criteria, validating evidence, marking state, and announcing the result.
