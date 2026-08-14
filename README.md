# Persistent Context Protocol

Persistent Context Protocol (PCP) gives AI coding agents repository-native project context and fast continuity across tools, machines, and simultaneous chats.

PCP 0.2 changes the operating model in three ways:

- synchronization is mandatory before every agent response or project-tool use;
- every conversation receives every newer continuity event, without workstream, dependency, scope, or path filtering; and
- adoption generates product-native instruction adapters, so normal use does not depend on copying a startup prompt into each chat.
- agent-operational knowledge remains in `.pcp`, while project-outcome knowledge lives in the project's established documentation directory or the default `docs/` directory and is tracked by path from `.pcp`.

The project-local engine optimizes the common no-change path and emits agent-friendly plain text. Separate execution IDs keep two chats for the same durable actor from acknowledging one another's updates.

See [Getting started](docs/getting-started.md) for adoption, automatic adapter behavior, and the recovery prompt. The [public documentation](docs/README.md) covers architecture, lifecycle, safety, compatibility, and capability lineage.

## 0.2 development status

PCP `0.2.0` is the current development contract. It replaces 0.1's scoped `status` operation with mandatory global `sync`, removes the Concurrent Execution Block capability and all dependency-sensitive workstream semantics, and retains optional flat work labels for lifecycle and completion evidence only.

An explicit 0.1 migration maps `kind: ceb` to `kind: concurrent`, removes dependency fields, deletes pristine CEB release assets, and discards obsolete scoped checkpoints. Existing actors, events, project-owned state, policy, and untargeted files are preserved. A customized project-owned CEB scaffold blocks automatic removal rather than losing useful content.

The historical [0.1.0 release notes](docs/release-notes.md) and [release-candidate audit](docs/release-candidate.md) remain evidence for that release. They do not describe the current 0.2 command contract.

## Intended model

- The `build-pcp` skill explores a project, synthesizes grounded context, resolves translation choices, and guides lifecycle decisions.
- The project-local `pcp` engine performs deterministic inventory, schemas, hashing, synchronization, validation, rendering, planning, transactions, and rollback.
- Generated adapters route each supported agent product into `.pcp/00-index.md` and mandate registration plus per-request synchronization.

PCP's operating context lives in `.pcp/`. Generated platform files are adapters, not independent memories. Project-outcome research, specifications, and other deliverable knowledge remain ordinary project documents outside `.pcp`; `.pcp/state/documentation.yaml` catalogs them so every agent can find and maintain them.

## Adoption states

One preview-first workflow handles:

1. State A — a seed or greenfield project described by a title, prompt, README, or prose;
2. State B — an established project with substantive assets and no persistent context layer;
3. State C — a project with existing non-PCP instruction, knowledge, memory, planning, or orchestration state; and
4. Managed — an existing valid PCP installation routed to ordinary lifecycle commands.

All adoption is preview-first. Semantic input is external and schema-valid, the normalized plan has an exact digest, and only `--apply <plan-digest>` authorizes its recomputed form. Adoption selects each project's documentation root from an established directory or defaults it to `docs/`, catalogs every surviving project document, and creates outcome documents outside `.pcp`. Every applicable State A, B, or C plan installs the same five generated platform delegations and validates their targets, sources, and content digests.

State C intake first requires an evidence-backed disposition for every detected foreign root. Translation then requires complete fingerprinted file/adapter/history/registry records. Ordinary files inside a translated root can still be marked `project-owned` and preserved unchanged; a reviewed regular file may be relocated to one collision-free project-owned destination. The plan binds reviewed coverage, preimages, replacements, relocations, removals, and deepest-first cleanup. An adapter surface outside the five-product contract fails closed.

Every successful adoption has clean genesis: grounded current context, zero actor profiles, and zero imported active, archived, or synthetic events.

## Product surfaces

- Display name: **Persistent Context Protocol**
- Repository: `persistentcontext`
- Installed layer: `.pcp/`
- Open skill: `build-pcp`
- Project-local executable: `pcp.mjs`
- Adapters: Codex, Antigravity, Claude Code Desktop, GitHub Copilot in Visual Studio Code, and Cursor

PCP proves that all five generated startup surfaces reconstruct the same canonical project context and contain the mandatory sync contract. This is an adapter-contract claim, not interactive certification or an unbypassable runtime hook.

The executable is project-local; this repository does not publish a global npm CLI.

## Current command surface

```text
pcp inspect
pcp adopt
pcp register
pcp sync
pcp record
pcp validate
pcp render
pcp workstream
pcp repair
pcp upgrade
pcp purge-history
```

Representative development-bundle commands:

```powershell
node dist/pcp.mjs inspect path/to/project --json
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/external-adoption.yaml --json
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/external-adoption.yaml --apply <plan-digest> --json
node dist/pcp.mjs register path/to/managed-project --client codex --json
node dist/pcp.mjs sync path/to/managed-project --actor-id <actor-id> --execution-id <execution-id>
node dist/pcp.mjs sync path/to/managed-project --actor-id <actor-id> --execution-id <execution-id> --acknowledge <sync-digest>
node dist/pcp.mjs record path/to/managed-project --input path/to/external-event.yaml --json
node dist/pcp.mjs validate path/to/managed-project --archive-index-only --json
node dist/pcp.mjs render path/to/managed-project --check --json
node dist/pcp.mjs workstream validate path/to/managed-project --json
node dist/pcp.mjs workstream complete path/to/managed-project --input path/to/external-workstream.yaml --json
node dist/pcp.mjs repair path/to/managed-project --json
node dist/pcp.mjs upgrade path/to/managed-project --check --json
node dist/pcp.mjs upgrade path/to/managed-project --json
node dist/pcp.mjs purge-history path/to/managed-project --json
```

`inspect` is non-mutating. `register` recovers or creates a stable profile and returns a fresh execution ULID; it creates no event. Every successful invocation returns a fresh execution ULID.

`sync` reads the actor, deterministic per-execution checkpoint, and active event filenames. It reads event bodies only when their ULIDs are newer. A new execution gets `.pcp/00-index.md` as its baseline. Plain output immediately reports no change or returns all newer events and current paths. Exact digest acknowledgement recomputes under the continuity lock and advances only that execution's ignored checkpoint without creating an event.

`record` accepts external schema-valid input, assigns an ordered event ULID and payload digest, validates performer/recorder attribution and stable caller-supplied `change_key` values, and writes one immutable event transactionally. Event 65 rotates the oldest 32 records from the at most 64-event active window.

Workstreams are optional flat descriptive records. Create and update replace one complete digest-bound record; completion requires one proof per criterion and an announcement. Workstreams contain no dependencies and never filter synchronization. Successful workstream changes atomically replace the registry, regenerate the view, and append one event.

Full `validate` checks schemas, structure, indexed canonical Markdown, external documentation roots and registry coverage, links, portability, secrets, ownership, generated views and adapters, identity, event payload digests and duplicate change keys, execution checkpoints, VCS authority, and optional clean genesis. Normal operations inspect archive IDs by filename without replaying archive bodies. `render --check` is non-mutating.

`repair` plans only missing or changed generated adapters. `upgrade --check` snapshots the canonical GitHub `main` revision and compares its template manifest version with the installed manifest version without mutation. `upgrade` merges project-specific manifest fields, distinguishes release-owned replacement from explicit versioned mechanical migration, and returns the project-derived paths that require agent semantic review against current source and documents. These operations bind exact preimages and complete inventory, reject downgrades and unsafe collisions, and prove untargeted and project/runtime-owned bytes remain unchanged.

After a completed version upgrade, the agent asks separately whether the human wants to purge PCP actor and continuity history. `purge-history` never follows from the update request alone: it requires its own preview and approved digest, removes profiles, active and archived events, checkpoints, and identity caches, creates no event, and preserves current project truth and Git history.

## Canonical layer and optional capabilities

The source baseline is [`templates/core/.pcp/`](templates/core/.pcp/). It uses versioned YAML for machine authority, numbered internal Markdown with folder indexes, an external project-document registry, bounded continuity, per-conversation checkpoints, generated views, and explicit Protocol, Project, Generated, and Runtime ownership.

Core-only projects select `[]`. Three optional overlays remain:

- `spec-driven-projects`
- `scratch-space`
- `walkthroughs`

PCP does not attempt to identify, monitor, or schedule project dependencies. `sequential` and `concurrent` are descriptive work-label kinds only.

The open skill ships checked copies of schemas, templates, the bundled engine, and checksum manifests. Build synchronizes one engine into `dist/pcp.mjs`, `skills/build-pcp/scripts/pcp.mjs`, and `templates/core/.pcp/tools/pcp.mjs`. Distribution verification executes both the bundled and installed engine.

## Version-control policy

PCP requires an explicit `none`, `human-owned`, recommended `human-commit`, `agent-managed`, or complete `custom` profile. It never infers Git authority from repository presence or installed tooling. Pull requests are recommended milestone boundaries rather than a protocol requirement.

## Develop

Requirements: Node.js 24 LTS and npm 11.16.0.

```powershell
npm ci
npm run verify
node dist/pcp.mjs --help
```

`npm run verify` checks formatting, lint, types, tests and coverage, bundled and installed engines, skill structure, package contents, private-data leakage, and the packaged lifecycle path.

## Adoption safety

Structural adoption, repair, and upgrade normalize and hash the complete plan, require the reviewed digest, recheck source bytes, stage outside the candidate, write a durable operation log, replace atomically, validate live state, and perform exact reverse rollback after caught failures. State C additionally requires complete root and source coverage, safe preimage-bound rewrites or relocations, replacement of supported adapters before removal, and preservation of project-owned material.

PCP does not claim to sandbox agents or force project instructions at the operating-system level. If a generated adapter is honored, its contract requires the agent to stop when registration, synchronization, the engine, or canonical validation fails.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
