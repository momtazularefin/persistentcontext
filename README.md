# Persistent Context Protocol

Persistent Context Protocol (PCP) is a repository-native protocol for preserving useful project context across AI agents, coding tools, sessions, machines, and operating-system changes.

Most coding agents can complete a task. The harder problem is helping the next agent understand what changed, why it changed, which rules still apply, and what work can safely continue. PCP is designed to make that context portable plain-text project state instead of leaving it trapped in conversations or one machine.

## Development status

PCP is under active `0.1.0` development. This first scaffold proves the TypeScript toolchain, open-skill packaging, deterministic engine bundle, CI contract, and private-data safeguards. Lifecycle commands are exposed in help output but intentionally fail closed until their corresponding verified milestone is implemented.

Do not use this revision to migrate a live context layer.

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

At the current scaffold milestone, use only `--help` and `--version`. Other commands explain that their implementation is not yet available and exit without modifying the target.

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

The public default will not perform Git writes without explicit user authorization.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
