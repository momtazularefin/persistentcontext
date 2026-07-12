# Persistent Context Protocol

Persistent Context Protocol (PCP): repository-native context, safe handoffs, and multi-agent continuity for AI coding agents across tools and machines.

Most coding agents can complete a task. The harder problem is helping the next agent understand what changed, why it changed, which rules still apply, and what work can safely continue. PCP is designed to make that context portable plain-text project state instead of leaving it trapped in conversations or one machine.

## Development status

PCP is under active `0.1.0` development. The engine performs read-only repository inventory and explainable intake classification, validates the canonical `.pcp/` contract, and deterministically checks or renders the generated project-status view. It fingerprints files with SHA-256, honors ignore and nested-repository boundaries, records symlinks without following them, and distinguishes a managed PCP project from State A, B, or C.

Do not use this revision to adopt or migrate a live context layer. Structural adoption, migration, registration, journaling, workstream mutation, repair, and upgrade remain fail-closed until their safety milestones are verified. `pcp render` may replace only its declared generated status view.

## Intended model

PCP separates two kinds of work:

- The `build-pcp` skill guides semantic exploration, knowledge synthesis, conflict resolution, and lifecycle decisions.
- The project-local `pcp` engine performs deterministic inventory, validation, rendering, fingerprinting, planning, and transactional filesystem operations.

An adopted project will keep its canonical context in `.pcp/`. Thin adapters for supported agent products will point to that same source rather than maintaining independent memories.

## Planned adoption states

One adoption workflow will support:

1. A seed or greenfield project described by a title, prompt, README, or plain language.
2. An established project with substantive assets but no persistent agent layer.
3. A project with an existing non-PCP instruction, knowledge, memory, planning, or orchestration layer.

All three states will converge on a clean genesis: grounded current context, no imported agent profiles, and no imported or synthetic journal events.

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

Three lifecycle operations are implemented:

```powershell
node dist/pcp.mjs inspect path/to/project
node dist/pcp.mjs inspect path/to/project --json
node dist/pcp.mjs validate path/to/managed-project --clean-genesis --json
node dist/pcp.mjs render path/to/managed-project --check --json
node dist/pcp.mjs render path/to/managed-project --json
```

`inspect` reports classification evidence and always reports `mutated: false`. `validate` checks schemas, core structure, numbered and indexed Markdown, links, portability, secrets, ownership, generated digests, identities, events, checkpoints, workstream dependencies, VCS authority, and optional clean genesis. `render --check` is non-mutating; write mode replaces only `.pcp/views/10-status.generated.md` from four schema-valid YAML sources. Other lifecycle commands explain that their implementation is unavailable and exit without mutation.

## Canonical layer

The source baseline lives under [`templates/core/.pcp/`](templates/core/.pcp/). It starts with zero agent profiles and zero journal events, keeps machine authority in versioned YAML, uses numbered Markdown with a `00-index.md` per folder, and separates protocol, project, generated, and runtime ownership. Optional overlays add spec-driven projects, Concurrent Execution Blocks, scratch space, and incremental walkthroughs.

The open skill ships byte-identical copies of the release schemas and templates plus a checksum manifest. The build verifies source/asset parity and executes bundled `inspect`, `validate`, and `render --check` on every platform gate.

## Version-control policy

PCP requires an explicit `none`, `human-owned`, recommended `agent-managed`, or complete `custom` profile. Until selection it performs no Git writes. The recommended flow gives agents routine branch, verified local unit commit, milestone push/PR, CI follow-up, and post-merge continuation responsibilities while the human reviews and merges. See the [bare-minimum Git and GitHub reference](templates/core/.pcp/references/10-git-github-bare-minimum.md).

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

## Safety direction

PCP structural operations will be preview-first. A mutation plan will be applied only by its approved digest after source fingerprints are rechecked. State C conversion will require complete source and history coverage, zero unresolved dispositions, and verified rollback before any foreign live layer is removed.

PCP never infers Git authority from a repository or installed tooling. The canonical VCS policy must assign each action explicitly.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
