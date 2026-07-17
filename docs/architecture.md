# Architecture

Persistent Context Protocol (PCP) is a repository-native context layer for durable project understanding, scoped agent handoffs, and safe multi-agent work. It uses plain Markdown and YAML for canonical state and a project-local executable for deterministic operations.

## Product boundary

PCP has five cooperating surfaces:

| Surface                    | Responsibility                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Protocol assets            | Define schemas, templates, invariants, ownership, adapters, and lifecycle rules.        |
| `build-pcp` skill          | Guides semantic exploration, synthesis, conflict resolution, and human decisions.       |
| Project-local `pcp` engine | Inventories, validates, fingerprints, plans, transacts, renders, repairs, and upgrades. |
| Platform adapters          | Route supported agent products to the same canonical entry point.                       |
| Installed `.pcp/` layer    | Stores one project's durable context, structured state, continuity, and local engine.   |

The semantic/deterministic split is intentional. An agent can interpret unfamiliar code and decide what knowledge matters; the engine can then enforce schemas, path boundaries, source fingerprints, approved plan digests, transactions, and exact rollback without improvisation.

## Canonical state

An installation has one authority hierarchy:

1. `.pcp/pcp.yaml` declares the protocol version, persistence profile, capabilities, ownership, adapters, and validation policy.
2. `.pcp/state/*.yaml` holds canonical structured project, registry, workstream, and VCS state.
3. Numbered project-owned Markdown holds grounded knowledge, working policy, plans, decisions, and optional project records.
4. Generated views and platform adapters are replaceable projections from declared canonical sources.
5. `.pcp/runtime/` contains ignored local caches and locks; it is never durable project context.

The repository outranks private agent memory. Current documents are authoritative; continuity events explain meaningful changes but are not replayed to reconstruct current state.

## Ownership model

| Owner     | Examples                                                | Lifecycle rule                                          |
| --------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Protocol  | schemas, protocol documents, installed engine           | Replaced only by a checked PCP release upgrade.         |
| Project   | knowledge, operations, project records, selected policy | Preserved through repair and upgrade.                   |
| Generated | status view and five product adapters                   | Rebuilt only from declared canonical sources.           |
| Runtime   | identity cache, locks, staging, recovery material       | Local and disposable; never treated as durable context. |

Unknown files are preserved until a reviewed plan assigns ownership. Upgrade separately fingerprints untargeted files and project/runtime-owned canonical files so preservation is executable evidence rather than an informal promise.

## Installed layout

```text
.pcp/
├── 00-index.md              # canonical human/agent entry
├── pcp.yaml                 # release and ownership manifest
├── protocol/                # static PCP operating rules
├── state/                   # canonical machine-readable state
├── knowledge/               # grounded project understanding
├── operations/              # living agreement, plan, decisions
├── projects/                # optional managed-project records
├── continuity/
│   ├── actors/              # stable human and agent identities
│   ├── events/              # bounded active reconciliation window
│   ├── archive/             # explicit-only older history
│   └── checkpoints/         # local scoped acknowledgement cursors
├── views/                   # generated projections
├── references/              # reusable operational guidance
├── templates/               # inert record scaffolds
├── schemas/                 # release validation contracts
└── tools/pcp.mjs            # checked project-local engine
```

Numbered Markdown folders have a `00-index.md` and an explicit reading order. Optional capabilities extend this layout through checked overlays rather than parallel context systems.

## Continuity model

A durable actor ID represents a human or agent across project tasks. Every command execution receives a separate ULID, so identity is not confused with a session. Registration itself creates no event.

Meaningful durable changes become immutable attributed events. The active window holds at most 64 records; adding event 65 rotates the oldest 32 to archive. Normal registration, status, and recording inspect archive identities by filename only. Archive contents are read only during an explicit audit, recovery, or historical request.

Scoped checkpoints bind one actor to an exact normalized workstream, dependency, semantic-scope, and path selection. `pcp status` identifies relevant newer events and current files; acknowledgement advances only the matching recomputed digest. Unrelated concurrent work remains visible without forcing a full reread.

## Work and concurrency

`.pcp/state/workstreams.yaml` is the one registry for sequential, concurrent, and Concurrent Execution Block work. Workstreams declare paths, semantic areas, dependencies, lifecycle state, and completion criteria. Mutations are bound to the current registry digest. Completion requires finished dependencies and exactly one proof for every criterion.

The optional Concurrent Execution Blocks capability adds coordination language and readable scaffolding over this same lifecycle. It does not create a second scheduler or state store.

## Platform adapters

PCP generates five thin startup surfaces for Codex, Antigravity, Claude Code Desktop, GitHub Copilot in Visual Studio Code, and Cursor IDE. Each adapter delegates to `.pcp/00-index.md`; adapters do not maintain independent memories. This is an adapter-contract claim: the documented product convention and canonical reconstruction contract are implemented, but every editor UI and release has not been interactively exercised.

## Portability and trust boundary

Durable state uses repository-relative forward-slash paths. Credentials, tokens, private keys, raw environment files, and private platform identifiers do not belong in PCP. External dependencies are recorded as non-secret requirements.

PCP validates filesystem integrity and event payload digests; it does not authenticate people or replace signed version control. VCS authority is explicit and may be `none`, `human-owned`, recommended `human-commit`, `agent-managed`, or a complete custom responsibility map.

## Deliberate non-goals for 0.1.0

- No hosted service, proprietary database, or required network control plane.
- No global npm CLI; the executable is project-local.
- No automatic inference of Git or hosting authority.
- No routine archive replay during startup.
- No claim that generated adapters replace product-specific capabilities beyond the documented instruction surface.
