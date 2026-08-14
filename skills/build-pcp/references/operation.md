# Ongoing operation

## Registration and mandatory synchronization

- Register an actor when a human or agent first needs durable attribution after adoption.
- Recover a cached stable identity when one exists; do not silently recalculate it.
- Create new IDs as `<actor-label>-<machine-label>-<10-character-Crockford-suffix>`. Use `antigravity`, `codex`, `claude`, `copilot`, or `cursor` as a known app label, `human` for a human, and one lowercase word for an app PCP does not define. Adapter IDs are separate integration identifiers and must not leak into new actor-ID prefixes.
- Derive the machine label automatically from the value returned by the machine's `hostname` command and normalize it to lowercase kebab-case. Do not ask the user to invent or pass a machine alias.
- Recover cached or uniquely matching legacy identities without renaming them. Stable identity immutability is stronger than a newer prefix convention.
- Treat a matching local cache as authoritative when its stored machine label differs from the current hostname. Without that cache, require `--actor-id` to recover a profile carrying a different legacy machine label.
- Keep actor, execution, and event IDs distinct. An actor is project-lifetime identity; a fresh execution ULID belongs to one chat.
- Retain the returned actor and execution IDs in conversation state.
- Before every response to a user request and before project-tool use, run global `sync` for that actor and execution.
- When sync returns changes, read every returned current path and acknowledge only the exact recomputed digest.
- Never filter synchronization by a workstream, scope, path, inferred dependency, or anticipated impact.
- If the engine or canonical layer is missing or invalid, stop project work rather than bypassing sync.

Registration, synchronization, acknowledgement, and unchanged rendering are operational actions, not continuity events.

Register an agent once per conversation with its app name. The engine obtains the machine label from the system hostname:

```text
node <pcp-engine> register <project-root> --client <app-name> --json
```

Known app labels are `antigravity`, `codex`, `claude`, `copilot`, and `cursor`; an otherwise undefined app uses one lowercase word. Register a human when durable attribution is first needed:

```text
node <pcp-engine> register <project-root> --actor-type human --json
```

Use `actor_id` for durable attribution and `execution_id` only for the current chat. A repeat call recovers the same matching actor and returns a new execution ID. If more than one profile matches, inspect profiles and pass the intended `--actor-id`; never guess.

Run the mandatory fast-path preview:

```text
node <pcp-engine> sync <project-root> --actor-id <actor-id> --execution-id <execution-id>
```

Plain output says immediately when no project update exists. Otherwise it returns every globally newer active event, attribution, rationale, affected paths, and current paths to absorb. A new execution receives `.pcp/00-index.md` as its baseline. Use events as locators and current canonical files as truth.

After absorbing every path, acknowledge the exact digest:

```text
node <pcp-engine> sync <project-root> --actor-id <actor-id> --execution-id <execution-id> --acknowledge <sync-digest>
```

Acknowledgement recomputes under the continuity lock. A mismatch fails without mutation. A match advances only the ignored checkpoint named by the execution ID and creates no event. Separate chats for the same actor remain independent. Routine sync may inspect archived ULIDs by filename to detect the active floor but never reads archived event contents.

## Meaningful changes

Record one minimal immutable event for a durable project change. Include performer, recorder, basis (`self`, `reported`, `observed`, or `system`), kind, affected labels/scopes/paths, summary, and useful rationale. The first informed agent records an otherwise unrecorded human change. Never edit an accepted event.

Prepare input outside the managed project and let the engine assign the event ULID:

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

Reported and observed events require a stable external `change_key`, such as `git:<commit>`, `svn:<revision>`, or `filesystem:sha256:<snapshot-digest>`. Summaries are at most 240 characters and rationale at most 1,000. At least one scope, workstream, or path is required as a locator, never as a sync filter.

The command serializes writers, computes a payload digest, and validates live state. Keep at most 64 active events. Before accepting event 65, the same transaction moves the oldest 32 immutable records to the archive. Full explicit validation checks archived payloads; routine work does not.

## Rendering and validation

```text
node <pcp-engine> validate <project-root> --archive-index-only --json
node <pcp-engine> render <project-root> --check --json
node <pcp-engine> render <project-root> --json
```

Use `--clean-genesis` only for a newly adopted candidate that must have no actors or events. Omit `--archive-index-only` only for an explicit archive audit or recovery. Generated Markdown is not independent authority. Use preview-first `repair` for missing or changed generated adapters.

## Descriptive workstreams

Workstreams are optional flat labels for lifecycle, affected paths or areas, completion criteria, evidence, and announcements. They are not dependency graphs, schedulers, source locks, CEBs, or sync boundaries.

First obtain the registry digest:

```text
node <pcp-engine> workstream validate <project-root> [--workstream <id>] --json
```

Create and update inputs contain the complete desired record:

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
  completion:
    criteria: [Implementation is reviewed., Tests pass.]
    evidence: []
```

```text
node <pcp-engine> workstream create <project-root> --input <external-workstream.yaml> --json
node <pcp-engine> workstream update <project-root> --input <external-workstream.yaml> --json
```

Complete active or blocked work with exactly one proof per criterion and a concise announcement:

```text
node <pcp-engine> workstream complete <project-root> --input <external-workstream.yaml> --json
```

The registry digest prevents stale replacement. Successful mutation replaces the registry, regenerates the view, and appends one attributed workstream event under the continuity lock.
