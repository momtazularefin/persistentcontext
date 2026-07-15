# Ongoing Operation

## Registration and reconciliation

- Register an actor when a human or agent first needs durable attribution after adoption.
- Recover a cached stable identity when one exists; do not silently recalculate it.
- A human uses the same `<actor-label>-<machine-label>-<10-character-Crockford-suffix>` pattern as an agent, with `human` as the actor label. Generate the suffix once; never use a shared counter. The first informed agent may register that human.
- Keep execution and event IDs separate from actor identity.
- Compare scoped checkpoints with newer active-event ULIDs.
- Load changes relevant to the active workstream, dependencies, shared policies, project registry, or overlapping paths.
- Advance a checkpoint only after referenced canonical state has been absorbed.
- If a checkpoint predates the active-event floor, rebuild the affected baseline from canonical current state; do not replay archived events during normal startup.

Registration, status checks, and unchanged rendering are operational actions, not continuity events.

Register an agent once per execution with its supported client label and a stable machine slug:

```text
node <pcp-engine> register <project-root> --client <client> --machine-label <machine-slug> --json
```

Supported client labels are `codex`, `antigravity`, `claude-code-desktop`, `github-copilot-vscode`, `cursor`, and `other`. Register a human when durable attribution is first needed:

```text
node <pcp-engine> register <project-root> --actor-type human --machine-label <machine-slug> --json
```

Use the returned `actor_id` for durable attribution and the returned `execution_id` only for the current execution. A repeat call must return the same actor and a new execution ID. When a local cache is missing, the engine recovers one matching profile. If more than one profile matches, inspect the profiles and pass the intended one with `--actor-id`; never guess. A stale or contradictory cache requires explicit repair and must not be bypassed by deleting the profile or inventing a new identity.

## Meaningful changes

Record one minimal immutable event for a durable project change. Include the performing actor, recording actor, basis (`self`, `reported`, `observed`, or `system`), kind, affected scope, summary, and affected paths; add rationale only when it helps reconciliation. The first agent informed of an unrecorded human change records it. Accept a human's VCS report without claiming verification, and report and correct any later contradiction. Never edit an existing event.

Keep at most 64 events in `continuity/events/`. Before adding event 65, move the oldest 32 immutable records to `continuity/archive/`. ULIDs remain unique across both locations. Archive history is explicit-audit material and is not part of normal agent reading.

## Rendering

Validate before relying on managed state:

```text
node <pcp-engine> validate <project-root> --json
```

Use `--clean-genesis` only for an adoption candidate that must contain zero actor profiles and zero active or archived events.

Check projections without mutation, then render when the policy permits generated-file replacement:

```text
node <pcp-engine> render <project-root> --check --json
node <pcp-engine> render <project-root> --json
```

Treat a digest mismatch as stale output. Generated Markdown is never an independent source of truth. State C adoption installs its approved generated adapters transactionally; standalone adapter regeneration remains unavailable.

## Workstreams and CEBs

Use generic workstream state for scope, dependencies, status, and completion evidence. Enable the Concurrent Execution Block capability when the project wants named parallel blocks. Complete a block only after detecting criteria, validating evidence, marking state, and announcing the result.
