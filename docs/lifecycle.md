# Lifecycle

PCP uses one lifecycle for seed projects, established repositories, foreign context layers, and managed installations. Structural changes are preview-first. Ordinary synchronization is mandatory, global, and optimized for the no-change case.

Commands below use the development bundle. Inside an adopted repository, generated adapters use the installed equivalent: `node .pcp/tools/pcp.mjs`.

## 1. Inspect and classify

```powershell
node dist/pcp.mjs inspect path/to/project --json
```

`inspect` inventories without mutation and classifies the candidate from evidence:

- State A: empty, title-only, prompt, README, or prose seed;
- State B: established project without persistent agent context;
- State C: foreign instruction, memory, planning, or orchestration layer; or
- Managed: a valid PCP installation.

Classification does not assume a source-tree shape. Inventory honors ignore and nested-repository boundaries, fingerprints binary and large files without semantic parsing, records symlinks without following them, and reports existing project-document candidates plus the recommended documentation root.

## 2. Adopt from an external semantic baseline

```powershell
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/adoption.yaml --json
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/adoption.yaml --apply <plan-digest> --json
```

The `build-pcp` skill progressively explores the candidate and prepares schema-valid input containing project identity, eight internal agent-operational documents, external outcome documents, a complete ordinary-project-document registry, policy, optional flat work labels, selected capabilities, and evidence. It reuses an established documentation directory or configures `docs/` when none exists. State C first requires an explicit disposition for every foreign root and then complete reviewed coverage for every translated source.

Preview does not mutate. Its digest binds the complete inventory, desired bytes, ownership, generated adapters, preimages, and ordered operations. Apply recomputes the plan, stages content and preimages outside the project, writes an operation log, replaces atomically, validates the live result, and performs reverse exact rollback after any caught failure.

Successful adoption has zero actor profiles, zero active events, and zero archived events. Grounded current context is imported; old identities, checkpoints, and history are not.

## 3. Register a conversation

```powershell
node dist/pcp.mjs register path/to/project --client codex --machine-label laptop --json
```

Registration creates or recovers one stable project-lifetime actor and returns a fresh execution ULID for the current chat. A stale cache, contradictory identity, or ambiguous recovery fails closed. The adapter retains both IDs in conversation state. Registration creates no event.

Each chat registers separately, even when it recovers the same actor. Checkpoints are keyed by execution ID so one chat cannot consume another chat's updates.

## 4. Synchronize before every response

```powershell
node dist/pcp.mjs sync path/to/project --actor-id <actor-id> --execution-id <execution-id>
node dist/pcp.mjs sync path/to/project --actor-id <actor-id> --execution-id <execution-id> --acknowledge <sync-digest>
```

The first command is read-only. It compares the conversation checkpoint with globally newer active-event IDs. When nothing changed, plain output reports that immediately. When events are newer, it returns all of them with attribution, rationale, affected paths, and the current canonical paths the agent must read. It never filters by workstream, inferred dependency, semantic scope, or path overlap.

After reading every returned current path, the agent submits the exact digest. Acknowledgement recomputes under the continuity lock and advances only that execution's ignored checkpoint; it creates no event. A stale digest fails without advancing. If the active window no longer reaches a new conversation's baseline, synchronization directs it to reconstruct from current canonical state; routine startup does not replay the archive.

Generated product adapters mandate this operation for every user request before answering or using project tools. Project instructions are not an operating-system interceptor, so PCP verifies the adapter contract and fails closed when followed without claiming universal model enforcement.

## 5. Record meaningful durable change

```powershell
node dist/pcp.mjs record path/to/project --input path/to/event.yaml --json
```

An event names the performer, recorder, evidence basis, concise summary and rationale, plus affected work labels, scopes, or paths. Reported and observed changes require a stable external `change_key`. The engine assigns a globally ordered ULID and payload digest under the continuity lock. Events are immutable; corrections are later events.

Inspection, registration, synchronization, acknowledgement, no-op rendering, and discussion without durable change are not events. Event 65 rotates the oldest 32 of the at most 64 active records into explicit-only archive history.

## 6. Manage optional work labels

```powershell
node dist/pcp.mjs workstream validate path/to/project --json
node dist/pcp.mjs workstream create path/to/project --input path/to/workstream.yaml --json
node dist/pcp.mjs workstream update path/to/project --input path/to/workstream.yaml --json
node dist/pcp.mjs workstream complete path/to/project --input path/to/workstream.yaml --json
```

Workstreams are flat descriptive labels, not dependency graphs or synchronization filters. Validate returns the registry digest used to prepare a create, update, or complete input. Successful mutation replaces the registry, regenerates the status view, and appends one attributed event atomically. Completion requires one proof per criterion and a human-facing announcement. A stale registry digest fails without accepted mutation.

## 7. Validate and render

```powershell
node dist/pcp.mjs validate path/to/project --json
node dist/pcp.mjs render path/to/project --check --json
node dist/pcp.mjs render path/to/project --json
```

Validation covers schemas, required structure, numbered and indexed internal Markdown, configured documentation roots, complete external-document registry coverage, related paths, links, portability, secret patterns, ownership, generated views and adapters, identities, event integrity, per-execution checkpoints, VCS authority, and optional clean genesis. Uncataloged, missing, misplaced outcome, or stale registry entries fail validation. Normal operations inspect archive IDs by filename; full validation is the explicit archive-content audit.

`render --check` is non-mutating. Write mode replaces only the declared generated status view from canonical YAML sources.

## 8. Repair or upgrade

```powershell
node dist/pcp.mjs repair path/to/project --json
node dist/pcp.mjs repair path/to/project --apply <plan-digest> --json
node dist/pcp.mjs upgrade path/to/project --json
node dist/pcp.mjs upgrade path/to/project --apply <plan-digest> --json
```

Repair plans only missing or changed generated adapters. Upgrade projects current release-owned protocol and generated assets onto a managed installation while preserving project and runtime ownership. The 0.1 migration adds documentation-root metadata and a complete documentation registry without relocating existing documents; when no established root exists it adds `docs/README.md` as the initial outcome document. Both are preview-first, preimage-bound, inventory-stable transactions with live validation and rollback.

The 0.1-to-0.2 upgrade removes the CEB capability and its pristine release assets, maps `kind: ceb` labels to `kind: concurrent`, removes workstream dependency fields, and discards obsolete scoped checkpoints. Existing actors and events remain; each post-upgrade conversation establishes a new per-execution baseline. A customized CEB scaffold blocks automatic removal so useful project-owned content is not silently lost.

Downgrades are rejected. Every untargeted inventory file and every project/runtime-owned canonical file is fingerprinted before and after apply.

## Version-control boundary

PCP never treats a repository or installed VCS tool as authority. The selected VCS profile assigns every action or prohibits it. Pull requests are recommended milestone boundaries, not a protocol requirement.
