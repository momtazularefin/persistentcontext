# Persistent Context Protocol

Persistent Context Protocol (PCP): repository-native context, safe handoffs, and multi-agent continuity for AI coding agents across tools and machines.

Most coding agents can complete a task. The harder problem is helping the next agent understand what changed, why it changed, which rules still apply, and what work can safely continue. PCP is designed to make that context portable plain-text project state instead of leaving it trapped in conversations or one machine.

## Development status

PCP is under active `0.1.0` development. The engine performs read-only repository inventory and explainable intake classification, safely adopts State A and State B projects, validates the canonical `.pcp/` contract, and deterministically checks or renders the generated project-status view. It fingerprints files with SHA-256, honors ignore and nested-repository boundaries, records symlinks without following them, and distinguishes a managed PCP project from State A, B, or C.

State A/B adoption is preview-first and requires an external, schema-valid semantic baseline plus the exact recomputed plan digest. State C foreign-layer translation, registration, event recording, workstream mutation, repair, and upgrade remain fail-closed until their safety milestones are verified. `pcp render` may replace only its declared generated status view.

## Intended model

PCP separates two kinds of work:

- The `build-pcp` skill guides semantic exploration, knowledge synthesis, conflict resolution, and lifecycle decisions.
- The project-local `pcp` engine performs deterministic inventory, validation, rendering, fingerprinting, planning, and transactional filesystem operations.

An adopted project will keep its canonical context in `.pcp/`. Thin adapters for supported agent products will point to that same source rather than maintaining independent memories.

## Adoption states

One adoption workflow classifies:

1. State A: a seed or greenfield project described by a title, prompt, README, or plain language. Preview and transactional adoption are implemented.
2. State B: an established project with substantive assets but no persistent agent layer. Grounded preview and transactional adoption are implemented without reorganizing project-owned assets.
3. State C: a project with an existing non-PCP instruction, knowledge, memory, planning, or orchestration layer. Classification is implemented; translation and removal remain unavailable until the coverage milestone.

Every successful adoption converges on a clean genesis: grounded current context, no actor profiles, and no imported, active, archived, or synthetic events.

## Product surfaces

- Display name: **Persistent Context Protocol**.
- Repository: `persistentcontext`.
- Installed layer: `.pcp/`.
- Open skill: `build-pcp`.
- Bundled executable: `pcp`.
- Initial supported products: Codex, Antigravity, and Claude Code Desktop.

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

Four lifecycle operations are implemented:

```powershell
node dist/pcp.mjs inspect path/to/project
node dist/pcp.mjs inspect path/to/project --json
node dist/pcp.mjs adopt --candidate path/to/project --json
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/external-adoption.yaml --json
node dist/pcp.mjs adopt --candidate path/to/project --input path/to/external-adoption.yaml --apply <plan-digest> --json
node dist/pcp.mjs validate path/to/managed-project --clean-genesis --json
node dist/pcp.mjs render path/to/managed-project --check --json
node dist/pcp.mjs render path/to/managed-project --json
```

`inspect` reports classification evidence and always reports `mutated: false`. `adopt` first returns structured questions and evidence; with an external semantic input it returns an exact non-mutating plan, and only `--apply <plan-digest>` authorizes the fully recomputed plan. `validate` checks schemas, core structure, numbered and indexed Markdown, links, portability, secrets, ownership, generated digests, identities, events, checkpoints, workstream dependencies, VCS authority, and optional clean genesis. `render --check` is non-mutating; write mode replaces only `.pcp/views/10-status.generated.md` from four schema-valid YAML sources. Other lifecycle commands explain that their implementation is unavailable and exit without mutation.

## Canonical layer

The source baseline lives under [`templates/core/.pcp/`](templates/core/.pcp/). It starts with zero actor profiles and zero active or archived events, keeps machine authority in versioned YAML, uses numbered Markdown with a `00-index.md` per folder, and separates protocol, project, generated, and runtime ownership. Ongoing installations keep identity, active events, archive, and scoped checkpoints together under `.pcp/continuity/`; the active window is capped at 64 records and rotates its oldest 32 records to explicit-only archive history. Optional overlays add spec-driven projects, Concurrent Execution Blocks, scratch space, and incremental walkthroughs.

The open skill ships byte-identical copies of the release schemas and templates plus a checksum manifest. The build verifies source/asset parity and executes bundled `inspect`, transactional State A adoption, `validate`, and `render --check` on every platform gate.

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

State A/B structural operations are preview-first. The engine normalizes and hashes the complete plan, requires the approved digest, recomputes it from the same external semantic input, and rejects source drift before acquiring mutation authority. Apply uses a project-scoped lock, external staging and preimages, a write-ahead operation log, atomic file replacement, reverse rollback with exact inventory verification, live canonical validation, and recovery cleanup after success.

State C conversion will additionally require complete source and history coverage, zero unresolved dispositions, and verified rollback before any foreign live layer is removed.

PCP never infers Git authority from a repository or installed tooling. The canonical VCS policy must assign each action explicitly.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
