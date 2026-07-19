# Lifecycle

PCP uses one lifecycle for new projects, established repositories, and projects that already contain another persistent context layer. Structural changes are preview-first; ordinary context reconciliation remains scoped and inexpensive.

## 1. Inspect without mutation

```powershell
node dist/pcp.mjs inspect path/to/project --json
```

Inspection inventories regular files, ignore rules, nested repositories, symlinks, manifests, deployment signals, and known context conventions. It records fingerprints and classification evidence without following symlinks or changing the candidate.

The result is one of four routes:

| Route   | Meaning                                                                                  | Next operation                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| State A | Empty, title-only, prompt, README, or prose seed.                                        | Gather indispensable choices and create a suitable initial project scaffold plus PCP.                             |
| State B | Established project with substantive assets and no persistent context layer.             | Explore progressively and add PCP without reorganizing project-owned assets.                                      |
| State C | Project with a foreign instruction, knowledge, memory, planning, or orchestration layer. | Translate reviewed current value, replace supported adapters, and remove only completely covered foreign context. |
| Managed | Valid PCP installation already exists.                                                   | Use registration, status, recording, workstream, repair, render, or upgrade commands.                             |

Classification depends on repository evidence, not a required pre-existing folder layout.

## 2. Build the semantic baseline

The `build-pcp` skill guides the judgment-heavy phase. It explores progressively, stops when the model is sufficiently grounded, and prepares one external schema-valid adoption input containing:

- project identity, purpose, type, lifecycle, artifact roots, and persistence profile;
- optional related projects and workstreams;
- an explicit VCS policy and capability selection;
- eight canonical knowledge and operations documents with evidence basis;
- State A scaffold files when appropriate; or
- a reviewed disposition for every detected State C foreign root, followed by a complete source/history coverage matrix for roots selected for translation.

State B cannot use adoption to add arbitrary project scaffold files. State C first returns `requires-root-review`; the reviewed input then returns scoped coverage. It cannot remove a source until every translated file and structured history entry has a non-unresolved disposition with required targets and evidence. Roots reviewed as `project-owned` remain untouched.

## 3. Preview the exact plan

```powershell
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/adoption.yaml --json
```

The engine validates the input, rebuilds the desired canonical layer, and returns an ordered mutation plan. Its digest binds the source inventory, canonical bytes, capabilities, adapters, ownership, preimages, and ordered operations. Preview does not mutate the candidate.

Review the classification, evidence, generated document content, adapter replacements, preserved files, removals, and plan digest. A changed source, input, disposition, target, preimage, or operation produces a different plan.

## 4. Apply only the reviewed digest

```powershell
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/adoption.yaml --apply <plan-digest> --json
```

Apply recomputes the plan before acquiring mutation authority. It then:

1. acquires a project-scoped structural lock;
2. stages desired bytes and exact preimages outside the candidate;
3. writes a durable operation log before each filesystem action;
4. uses atomic file replacement and checked directory creation/removal;
5. revalidates source stability and the live canonical layer;
6. validates all five adapter manifests, sources, and content digests;
7. restores exact preimages in reverse order after any caught failure; and
8. removes recovery material only after successful live acceptance.

State C adds explicit root-scope review, coverage-bound removal checks, replacement-first adapter ordering, preservation of `project-owned` roots and files, and a fail-closed boundary for unknown or unsupported adapter surfaces.

Every successful adoption starts with clean genesis: zero actor profiles, zero active events, and zero archived events. Grounded current context is imported; foreign identities and history are not.

## 5. Register once per execution

```powershell
node dist/pcp.mjs register path/to/project --client codex --machine-label laptop --json
```

Registration creates or recovers a stable project-lifetime actor profile and stores a matching ignored local cache. A stale cache, contradictory identity, or ambiguous recovery fails closed. Every successful invocation returns a fresh execution ULID. Registration validates continuity but creates no event.

Humans use the same actor model. The first informed agent can register a human when it needs to record reported or observed human work.

## 6. Reconcile only the active scope

```powershell
node dist/pcp.mjs status path/to/project --actor-id <actor-id> --workstream <id> --json
node dist/pcp.mjs status path/to/project --actor-id <actor-id> --workstream <id> --acknowledge <status-digest> --json
```

Preview expands the selected workstream through dependencies, compares its exact scoped checkpoint with newer active events, and returns relevant changes, visible out-of-scope changes, and current context paths to read. It does not write.

After absorbing those current documents, submit the returned digest. Acknowledgement recomputes the view under the continuity lock and advances only the matching local checkpoint. It changes no project document and creates no event. If the checkpoint predates the active-event floor, rebuild only the affected scope from current canonical state; routine startup does not replay the archive.

## 7. Record meaningful durable change

```powershell
node dist/pcp.mjs record path/to/project --input path/to/event.yaml --json
```

Record the performer, recorder, evidence basis, concise summary, and affected semantic scopes, workstreams, or paths. Reported and observed changes require a stable external `change_key`, such as a Git commit, Subversion revision, or filesystem snapshot digest. Duplicate active-window keys fail under the continuity lock.

The engine assigns the globally ordered event ULID and a SHA-256 payload digest. Events are immutable; corrections are later events. Inspection, registration, synchronization, no-op rendering, and adoption are not continuity events.

## 8. Manage bounded work

```powershell
node dist/pcp.mjs workstream validate path/to/project --json
node dist/pcp.mjs workstream create path/to/project --input path/to/workstream.yaml --json
node dist/pcp.mjs workstream update path/to/project --input path/to/workstream.yaml --json
node dist/pcp.mjs workstream complete path/to/project --input path/to/workstream.yaml --json
```

Validate returns the exact registry digest used to prepare create, update, or complete input. A successful mutation replaces the registry, regenerates the status view, and appends its attributed event under one lock. Stale digests and dependency conflicts fail without accepted mutation. Completion requires completed dependencies, one proof per criterion, and a human-facing announcement.

## 9. Validate and render

```powershell
node dist/pcp.mjs validate path/to/project --json
node dist/pcp.mjs render path/to/project --check --json
node dist/pcp.mjs render path/to/project --json
```

Validation covers release schemas, required structure, numbered and indexed Markdown, links, portability, secret patterns, ownership, generated views and adapters, identities, event integrity, checkpoints, workstream dependencies, VCS authority, and optional clean genesis.

Normal operations may validate archive filenames without reading historical content. Full validation is the explicit archive-content audit. `render --check` is non-mutating; write mode replaces only the declared generated status view.

## 10. Repair or upgrade with preservation proof

```powershell
node dist/pcp.mjs repair path/to/project --json
node dist/pcp.mjs repair path/to/project --apply <plan-digest> --json
node dist/pcp.mjs upgrade path/to/project --json
node dist/pcp.mjs upgrade path/to/project --apply <plan-digest> --json
```

Repair plans only missing or changed generated adapters. Upgrade projects the running release's protocol and generated assets onto the installation while preserving selected capabilities and project policy. Both operations bind replacements to exact preimages and the complete inventory, reject unsafe collisions and stale approval, and use the same structural transaction and rollback guarantees as adoption.

Upgrade rejects downgrades and writes only approved protocol/generated targets. Every untargeted file and every project/runtime-owned canonical file is fingerprinted before and after apply.

## Version-control boundary

PCP never treats repository presence or installed tooling as permission. The selected VCS profile assigns every action or prohibits it. The recommended `human-commit` flow has agents prepare verified units and exact signed-commit commands while the human reviews, stages, signs, and reports completion. Pull requests are recommended milestone boundaries, not a protocol requirement.
