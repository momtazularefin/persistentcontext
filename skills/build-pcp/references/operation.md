# Ongoing Operation

## Registration and reconciliation

- Register an actor when a human or agent first needs durable attribution after adoption.
- Recover a cached stable identity when one exists; do not silently recalculate it.
- A human uses the same `<actor-label>-<machine-label>-<10-character-Crockford-suffix>` pattern as an agent, with `human` as the actor label. Generate the suffix once; never use a shared counter. The first informed agent may register that human.
- Keep execution and event IDs separate from actor identity.
- Compare scoped checkpoints with newer active-event ULIDs. One checkpoint identity consists of the agent, selected workstream, expanded dependencies, semantic scopes, and paths.
- Load changes relevant to the active workstream, dependencies, shared policies, project and workstream registries, project state, or overlapping paths. Keep unrelated concurrent changes visible without treating them as required context.
- Preview status first. Advance a checkpoint only after referenced canonical state has been absorbed and the exact preview digest still matches a fresh recomputation.
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

Preview a global or scoped reconciliation without mutation:

```text
node <pcp-engine> status <project-root> --actor-id <actor-id> [--workstream <id>] [--scope <slug...>] [--path <relative-path...>] --json
```

Read the current paths in `required_context_paths`, using events as locators rather than as reconstructed state. After that context is absorbed, acknowledge only the returned digest:

```text
node <pcp-engine> status <project-root> --actor-id <actor-id> [same scope options] --acknowledge <status-digest> --json
```

Acknowledgement recomputes under the shared continuity lock. A mismatch fails without mutation. A match advances only the ignored local checkpoint to the newest active event, creates no event, and makes a repeated current status acknowledgement unnecessary. Normal registration and status may inspect archived ULIDs by filename to detect the active floor, but never read archived event contents.

## Meaningful changes

Record one minimal immutable event for a durable project change. Include the performing actor, recording actor, basis (`self`, `reported`, `observed`, or `system`), kind, affected scope, summary, and affected paths; add rationale only when it helps reconciliation. The first agent informed of an unrecorded human change records it. Accept a human's VCS report without claiming verification, and report and correct any later contradiction. Never edit an existing event.

Prepare the transient input outside the managed project, then let the engine assign the event ULID. Omit `occurred_at` to use the recording time, or supply it when the action happened earlier:

```yaml
schema_version: 1
actor: { type: agent, id: <performing-actor-id> }
recorded_by: { type: agent, id: <recording-actor-id> }
basis: self
kind: code
scopes: [implementation]
workstreams: []
summary: Implemented one coherent project change.
affected_paths: [src/example.ts]
```

```text
node <pcp-engine> record <project-root> --input <external-event.yaml> --json
```

Use `reported` when a human tells the recorder about an action and `observed` when the recorder notices it independently. Register the human first if no durable profile exists. For either basis, supply a stable `change_key` from the external action, such as `git:<commit>`, `svn:<revision>`, or `filesystem:sha256:<snapshot-digest>`; never infer identity from matching prose or timestamps. Concurrent attempts with the same active key serialize so only one event is accepted. Use `system` only with system as both actor and recorder. Keep summaries at or below 240 characters and rationale at or below 1,000. At least one scope, workstream, or affected path is required so reconciliation can locate the change.

The command validates the installed layer and attribution before mutation, serializes concurrent writers, assigns a payload digest, and validates the live result. That digest detects an uncoordinated schema-valid payload rewrite; it is tamper evidence rather than a signature. Keep at most 64 events in `continuity/events/`. Before adding event 65, the same transaction moves the oldest 32 immutable records to `continuity/archive/`; a caught failure restores exact active contents and archive identities. ULIDs remain unique and ordered across both locations. Archive history is explicit-audit material and is not part of normal agent reading; only full explicit validation checks archived digests or duplicate change keys.

## Rendering

Validate current operational state without reading archived event contents:

```text
node <pcp-engine> validate <project-root> --archive-index-only --json
```

Omit `--archive-index-only` only for an explicit archive audit, recovery, or historical integrity check.

Use `--clean-genesis` only for an adoption candidate that must contain zero actor profiles and zero active or archived events.

Check projections without mutation, then render when the policy permits generated-file replacement:

```text
node <pcp-engine> render <project-root> --check --json
node <pcp-engine> render <project-root> --json
```

Treat a digest mismatch as stale output. Generated Markdown is never an independent source of truth. Adoption installs generated adapters transactionally; use the preview-first `repair` workflow for missing or changed installed adapters.

## Workstreams and CEBs

Use generic workstream state for scope, dependencies, lifecycle, and completion evidence. First obtain the exact current registry digest without mutation:

```text
node <pcp-engine> workstream validate <project-root> [--workstream <id>] --json
```

Prepare a transient schema-valid input outside the managed project. `create` and `update` carry the complete desired workstream, not a partial patch:

```yaml
schema_version: 1
operation: create
expected_registry_digest: <digest-from-validate>
actor: { type: agent, id: <performing-actor-id> }
recorded_by: { type: agent, id: <recording-actor-id> }
basis: self
summary: Created the implementation workstream.
workstream:
  workstream_id: implementation
  name: Implementation
  kind: concurrent
  status: planned
  paths: [src, tests]
  areas: [implementation, validation]
  dependencies: []
  completion:
    criteria: [Implementation is reviewed., Tests pass.]
    evidence: []
```

```text
node <pcp-engine> workstream create <project-root> --input <external-workstream.yaml> --json
node <pcp-engine> workstream update <project-root> --input <external-workstream.yaml> --json
```

Do not set `status: complete` through `update`. Complete active or blocked work with one exact criterion-to-proof mapping for every declared criterion and a concise announcement:

```yaml
schema_version: 1
operation: complete
expected_registry_digest: <digest-from-validate>
actor: { type: agent, id: <performing-actor-id> }
recorded_by: { type: agent, id: <recording-actor-id> }
basis: self
summary: Completed the implementation workstream.
workstream_id: implementation
evidence:
  - criterion: Implementation is reviewed.
    proof: Review decision is recorded in operations/30-decisions.md.
  - criterion: Tests pass.
    proof: The verified project test command passed.
announcement: Implementation is complete; dependent work may begin.
```

```text
node <pcp-engine> workstream complete <project-root> --input <external-workstream.yaml> --json
```

The digest prevents a stale plan from overwriting concurrent work. `complete` also requires every dependency to be complete. Successful mutation replaces the registry, regenerates its status view, and appends one workstream event under the same continuity lock; a caught failure restores all three histories exactly.

Enable the Concurrent Execution Block capability when the project wants named parallel blocks. A CEB is simply `kind: ceb` plus the optional human guidance; it uses the same commands, registry, dependencies, evidence rules, and completion announcement.
