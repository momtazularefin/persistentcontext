# Persistent Context Protocol

Persistent Context Protocol (PCP): repository-native context, safe handoffs, and multi-agent continuity for AI coding agents across tools and machines.

Most coding agents can complete a task. The harder problem is helping the next agent understand what changed, why it changed, which rules still apply, and what work can safely continue. PCP is designed to make that context portable plain-text project state instead of leaving it trapped in conversations or one machine.

## Development status

PCP is under active `0.1.0` development. The engine performs read-only repository inventory and explainable intake classification, safely adopts State A and State B projects, and translates reviewed State C foreign context into canonical PCP state. It creates or recovers stable human and agent identities while issuing a separate execution ULID for each registration. It previews scoped reconciliation across workstreams, dependencies, shared state, and overlapping paths, then advances a local checkpoint only when the caller acknowledges the exact recomputed status digest. It records meaningful durable changes as minimal immutable events, preserving the distinction between who acted and who reported or observed the action. It manages digest-bound workstream creation, updates, validation, and evidence-backed completion while keeping the canonical registry, generated view, and attributed history atomic. It validates the canonical `.pcp/` contract and deterministically checks or renders the generated project-status view. Every adoption installs the exact checked self-contained engine at `.pcp/tools/pcp.mjs`; upgrade keeps that project-local engine byte-identical to the running release. It fingerprints files with SHA-256, honors ignore and nested-repository boundaries, records symlinks without following them, and distinguishes a managed PCP project from State A, B, or C.

All adoption is preview-first and requires an external, schema-valid semantic baseline plus the exact recomputed plan digest. Every applicable State A, B, or C plan installs the same five generated platform delegations, reserves their paths from scaffold ownership, and validates their manifest, sources, and content digests before acceptance. State C intake additionally discovers complete foreign directories from semantic anchors, emits fingerprinted file/adapter/history/registry records, and validates a completed matrix against the current repository and staged canonical files. Ordinary project files caught by cautious directory expansion can be marked `project-owned` and preserved unchanged. Completed coverage adds reviewed adapter replacements and fingerprinted foreign-file removals bound to a normalized coverage digest. Existing adapter targets become explicit preimage-backed replacements, and legacy scoped rules are removed only after their canonical PCP delegation is ready. The approved plan applies through the same lock, staging, live-validation, and exact-rollback transaction used by other adoption states. An adapter surface outside the five-product contract fails closed rather than being deleted. Managed projects can preview and apply digest-bound repair of generated adapters or ownership-aware release upgrades. Upgrade replaces only approved protocol/generated targets and proves that every untargeted and project/runtime-owned file remains byte-identical. `pcp render` remains the generated status-view operation.

## Intended model

PCP separates two kinds of work:

- The `build-pcp` skill guides semantic exploration, knowledge synthesis, conflict resolution, and lifecycle decisions.
- The project-local `pcp` engine performs deterministic inventory, validation, rendering, fingerprinting, planning, and transactional filesystem operations.

An adopted project will keep its canonical context in `.pcp/`. Thin adapters for supported agent products will point to that same source rather than maintaining independent memories.

## Adoption states

One adoption workflow classifies:

1. State A: a seed or greenfield project described by a title, prompt, README, or plain language. Preview and transactional adoption are implemented.
2. State B: an established project with substantive assets but no persistent agent layer. Grounded preview and transactional adoption are implemented without reorganizing project-owned assets.
3. State C: a project with an existing non-PCP instruction, knowledge, memory, planning, or orchestration layer. Classification, transient source/entry coverage, canonical adapter replacement planning, preview, transactional apply, live validation, and exact rollback are implemented.

Adoption also takes an explicit capability selection. Core-only projects use an empty array; supported opt-in overlays add Concurrent Execution Blocks, spec-driven projects, scratch space, or walkthroughs through the same checked plan and transaction.

Every successful adoption converges on a clean genesis: grounded current context, no actor profiles, and no imported, active, archived, or synthetic events.

## Product surfaces

- Display name: **Persistent Context Protocol**.
- Repository: `persistentcontext`.
- Installed layer: `.pcp/`.
- Open skill: `build-pcp`.
- Bundled executable: `pcp`.
- `0.1.0` adapters: [Codex](https://developers.openai.com/codex/guides/agents-md/), [Antigravity](https://antigravity.google/docs/rules-workflows), [Claude Code Desktop](https://code.claude.com/docs/en/desktop), [GitHub Copilot in Visual Studio Code](https://code.visualstudio.com/docs/copilot/customization/custom-instructions), and [Cursor IDE](https://docs.cursor.com/context/rules). PCP follows each product's documented project-instruction convention and proves that all five generated startup surfaces reconstruct the same canonical project context. This is an adapter-contract claim, not a claim that every editor UI and release has been exercised interactively.

The executable is project-local in `0.1.0`; this repository does not publish a global npm CLI.

## Current command surface

```text
pcp inspect
pcp adopt
pcp register
pcp status
pcp record
pcp validate
pcp render
pcp workstream
pcp upgrade
pcp repair
```

All ten lifecycle operations are implemented:

```powershell
node dist/pcp.mjs inspect path/to/project
node dist/pcp.mjs inspect path/to/project --json
node dist/pcp.mjs adopt --candidate path/to/project --json
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/external-adoption.yaml --json
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/external-adoption.yaml --apply <plan-digest> --json
node dist/pcp.mjs register path/to/managed-project --client codex --machine-label laptop --json
node dist/pcp.mjs register path/to/managed-project --actor-type human --machine-label laptop --json
node dist/pcp.mjs status path/to/managed-project --actor-id <actor-id> --workstream <id> --json
node dist/pcp.mjs status path/to/managed-project --actor-id <actor-id> --workstream <id> --acknowledge <status-digest> --json
node dist/pcp.mjs record path/to/managed-project --input path/to/external-event.yaml --json
node dist/pcp.mjs validate path/to/managed-project --archive-index-only --json
node dist/pcp.mjs validate path/to/adoption-candidate --clean-genesis --json
node dist/pcp.mjs render path/to/managed-project --check --json
node dist/pcp.mjs render path/to/managed-project --json
node dist/pcp.mjs workstream validate path/to/managed-project --json
node dist/pcp.mjs workstream create path/to/managed-project --input path/to/external-workstream.yaml --json
node dist/pcp.mjs workstream update path/to/managed-project --input path/to/external-workstream.yaml --json
node dist/pcp.mjs workstream complete path/to/managed-project --input path/to/external-workstream.yaml --json
node dist/pcp.mjs repair path/to/managed-project --json
node dist/pcp.mjs repair path/to/managed-project --apply <plan-digest> --json
node dist/pcp.mjs upgrade path/to/managed-project --json
node dist/pcp.mjs upgrade path/to/managed-project --apply <plan-digest> --json
```

`inspect` reports classification evidence and always reports `mutated: false`. `adopt` first returns structured questions and evidence. Completed semantic input produces an exact non-mutating plan with five deterministic adapter paths and content digests, and only `--apply <plan-digest>` authorizes its fully recomputed form. For State C, that digest also binds the reviewed coverage, canonical content, preimages, and removal paths. Apply revalidates the live canonical layer and complete adapter set before accepting any adoption. `register` validates the installed layer, serializes simultaneous attempts, recovers a matching profile before creating one, and caches the durable actor ID under ignored `.pcp/runtime/`; a stale cache or ambiguous recovery fails closed. Every successful invocation returns a fresh execution ULID and creates no continuity event. `status` expands the selected workstream through dependencies, reports relevant and visible out-of-scope active changes, and identifies current paths to read. Preview is immutable. `--acknowledge <status-digest>` recomputes under the same continuity lock and advances only one ignored checkpoint after a match; it creates no event. `record` accepts one external schema-valid event input, assigns the next globally ordered ULID and a payload digest under the continuity lock, validates attribution and workstream references, and transactionally writes one immutable event. Reported and observed changes require a stable caller-supplied `change_key`; duplicate active keys fail without mutation, while the payload digest exposes an uncoordinated schema-valid rewrite. Event 65 rotates the oldest 32 active records before it is accepted, with exact rollback on any caught failure. `workstream validate` returns the exact registry digest without mutation. `create` and `update` accept a complete external workstream record bound to that digest; `complete` requires one proof per criterion, completed dependencies, and a human-facing announcement. Every successful workstream mutation replaces the registry, regenerates the status view, and appends its attributed event under one continuity lock. A stale concurrent plan fails, and every caught failure restores exact registry, view, active-history, and archive preimages. CEBs use this same generic lifecycle. Normal registration, status, recording, workstream operation, and `validate --archive-index-only` inspect archived ULIDs by filename without reading archive contents. Full `validate` is the explicit archive-audit path and also checks schemas, core structure, numbered and indexed Markdown, links, portability, secrets, ownership, generated views and adapters, identities, event payload digests and duplicate change keys, checkpoints, workstream dependencies, VCS authority, and optional clean genesis. `render --check` is non-mutating; write mode replaces only `.pcp/views/10-status.generated.md` from four schema-valid YAML sources. `repair` plans only missing or changed generated adapters. `upgrade` merges project-specific manifest fields into the current release manifest and plans only release protocol files, the generated status view, and the five adapters. Both commands are preview-first, bind replacements to exact preimages and the complete inventory, reject downgrades and unsafe collisions, and apply under continuity plus structural locks with live validation and exact rollback. Upgrade separately hashes every untargeted inventory file and every project/runtime-owned canonical file before and after apply.

## Canonical layer

The source baseline lives under [`templates/core/.pcp/`](templates/core/.pcp/). It starts with zero actor profiles and zero active or archived events, keeps machine authority in versioned YAML, uses numbered Markdown with a `00-index.md` per folder, and separates protocol, project, generated, and runtime ownership. Ongoing installations keep durable identity, active events, archive, and scoped checkpoints together under `.pcp/continuity/`, while ignored `.pcp/runtime/actors/` caches project-local identity recovery. The active event window is capped at 64 records and rotates its oldest 32 records to explicit-only archive history. Optional overlays add spec-driven projects, Concurrent Execution Blocks, scratch space, and incremental walkthroughs.

The open skill ships byte-identical copies of the release schemas, templates, bundled engine, and installed engine plus checksum manifests. The build synchronizes one engine into `dist/pcp.mjs`, `skills/build-pcp/scripts/pcp.mjs`, and `templates/core/.pcp/tools/pcp.mjs`. Distribution verification adopts a project, proves the installed bytes and checksum match that release, and executes the installed engine independently before continuing the lifecycle probes.

The [capability lineage and parity record](docs/capability-parity.md) traces the practical orchestration behaviors that PCP preserves and the earlier mechanisms it deliberately supersedes. Each claim is backed by a machine-readable record and contract-tested public evidence.

## Version-control policy

PCP requires an explicit `none`, `human-owned`, recommended `human-commit`, `agent-managed`, or complete `custom` profile. Until selection it performs no VCS writes. In the recommended profile, agents prepare and verify coherent units, then hand the human exact signed-commit commands and wait for confirmation. Milestone PRs are recommended rather than enforced; projects may change the responsibility map, decline PRs, or use a non-Git system through a custom policy. See the [bare-minimum Git and GitHub reference](templates/core/.pcp/references/10-git-github-bare-minimum.md).

## Develop

Requirements:

- Node.js 24 LTS.
- npm 11.16.0.

```powershell
npm ci
npm run verify
node dist/pcp.mjs --help
```

`npm run verify` checks formatting, lint, types, tests and coverage, the bundled engine, skill structure, distribution integrity, and private-data leakage.

## Adoption safety

All structural adoption operations are preview-first. The engine normalizes and hashes the complete plan, requires the approved digest, recomputes it from the same external semantic input, and rejects source drift before acquiring mutation authority. Apply uses a project-scoped lock, external staging and preimages, a write-ahead operation log, atomic file replacement, reverse rollback with exact inventory verification, live canonical validation, and recovery cleanup after success.

Every adoption live-acceptance gate validates clean canonical genesis, all five adapter manifests and content digests, final managed classification for tracked installs, desired hashes, and candidate-owned source stability. State C additionally requires complete source and history coverage, zero unresolved dispositions, real staged canonical targets, explicit preimage hashes, a verified replacement for every adapter surface, removal validation, and preservation of every `project-owned` file. Any failure restores the exact pre-adoption inventory and retains recovery evidence for inspection.

PCP never infers Git authority from a repository or installed tooling. The canonical VCS policy must assign each action explicitly.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
