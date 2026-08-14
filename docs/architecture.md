# Architecture

Persistent Context Protocol (PCP) is a repository-native context layer for durable project understanding and fast cross-conversation continuity. It uses plain Markdown and YAML for canonical state, generated product instruction adapters for automatic discovery, and a project-local executable for deterministic operations.

The repository outranks private agent memory. A conversation may cache its actor and execution IDs, but project operating facts, policy, history, and synchronization authority remain in `.pcp/`. Knowledge produced as the project's actual outcome remains ordinary documentation outside `.pcp` and is indexed from canonical state.

## Five cooperating surfaces

1. **Protocol assets** define the portable canonical structure, schemas, ownership rules, and operating contract.
2. The **`build-pcp` skill** handles judgment-heavy exploration, adoption, migration, and maintenance.
3. The **project-local `pcp` engine** performs deterministic inventory, validation, synchronization, rendering, and transactional mutation.
4. **Generated platform adapters** make the contract discoverable through each supported product's project-instruction convention.
5. **Public evidence and tests** verify package identity, lifecycle behavior, safety boundaries, and adapter equivalence.

The skill decides what project context means. The engine decides whether bytes, schemas, identities, digests, and filesystem operations satisfy the protocol. The adapters carry a short mandatory operating contract; they never become independent context stores.

## Canonical layout

```text
.pcp/
├── 00-index.md             # canonical entry and returning-task contract
├── pcp.yaml                # installation manifest and release identity
├── protocol/               # portable rules
├── knowledge/              # grounded agent-operational understanding
├── operations/             # working agreements, plans, and decisions
├── projects/               # optional readable project records
├── state/                  # machine-readable current truth
│   ├── project.yaml
│   ├── projects.yaml
│   ├── documentation.yaml  # all ordinary project documents and maintenance cues
│   ├── workstreams.yaml    # optional flat descriptive work labels
│   └── vcs-policy.yaml
├── continuity/
│   ├── actors/             # stable project-lifetime identities
│   ├── events/             # bounded active change records
│   ├── archive/            # explicit-only older history
│   └── checkpoints/        # ignored per-conversation sync cursors
├── views/                  # deterministic generated Markdown
├── templates/              # project-owned scaffolds
├── references/             # optional references
├── runtime/                # ignored locks, caches, and recovery state
└── tools/                  # exact installed engine and checksum

docs/ or existing-doc-root/ # project-outcome knowledge outside .pcp
```

Each project state record declares `documentation_root` and whether adoption reused an `existing` folder or created the `default` `docs/` convention. Outcome documents must live beneath that root. `.pcp/state/documentation.yaml` also catalogs reference documents elsewhere in the repository, such as a root README, with ownership, status, summary, and related source or document paths. This gives agents a RAG-like navigation map without turning deliverable knowledge into agent-internal context.

Canonical records have four ownership classes:

- **Protocol** files are release-owned rules and schemas.
- **Project** files contain project-specific meaning and policy.
- **Generated** files are deterministic projections or adapters.
- **Runtime** files contain local operational state and are not portable authority.

Upgrade and repair use these boundaries rather than treating every `.pcp/` file alike.

## Mandatory global synchronization

Registration separates a stable `actor_id` from a fresh `execution_id`. One execution ID belongs to one conversation. The checkpoint key is therefore `(actor_id, execution_id)`, preventing two chats for the same agent from consuming each other's updates.

Every user request triggers the same deterministic sequence before an answer or project-tool use:

```text
generated adapter
  -> register once if conversation identity is missing
  -> sync(actor_id, execution_id)
       -> no newer event: return immediately
       -> newer events: return all changes and current paths
  -> read returned current paths
  -> acknowledge the exact sync digest
  -> continue with the request
```

Synchronization is global. Workstream, path, area, and semantic labels do not filter event delivery. This deliberately spends a small, predictable read cost to avoid missing a change because an agent inferred dependencies incorrectly.

The fast path reads the actor, deterministic checkpoint, and active event filenames. It opens event bodies only when their ordered IDs are newer than the conversation checkpoint. The archive is not replayed during routine synchronization. A null checkpoint uses `.pcp/00-index.md` as its baseline; archive filenames are consulted only when needed to detect that active history no longer covers the baseline.

Sync uses a two-phase digest acknowledgement. Preview does not mutate. After the agent absorbs the returned files, acknowledgement recomputes under the continuity lock and advances only that execution's ignored checkpoint. If the conversation crashes before acknowledgement, the update is offered again.

## Continuity and work labels

Continuity events describe meaningful durable change and distinguish performer, recorder, and evidence basis. Current canonical documents remain authoritative; event prose is not replayed to reconstruct truth. Active history contains at most 64 records. When event 65 is accepted, the oldest 32 rotate atomically into explicit-only archive history.

Workstreams provide optional names, lifecycle status, paths or areas, completion criteria, evidence, and announcements. They are flat descriptive records. PCP does not model dependencies, schedule parallel work, infer impact, or use workstream membership as a synchronization boundary.

## Platform discovery boundary

Adoption generates five product-native instruction surfaces. PCP validates their exact content, source declaration, target, digest, repair behavior, and equivalent reconstruction of canonical project state. This is an adapter-contract claim, not a claim that PCP controls a product runtime.

Project instructions are portable guidance, not a process-level enforcement hook. Product settings or modes may disable them, and model compliance cannot be proven by repository code. The generated contract therefore fails closed when followed: if identity, the engine, synchronization, or canonical validation fails, the agent must stop project work rather than silently continue. Platform-specific hooks may strengthen enforcement while `.pcp/` remains the sole context authority.

## Deliberate non-goals for 0.2

- Building or monitoring a dependency graph.
- Determining which change affects which task.
- Providing a scheduler, lock manager for source ownership, or hosted coordination service.
- Authenticating actors or proving model compliance with generated instructions.
- Replacing VCS permissions, branch protection, backups, or product security controls.
