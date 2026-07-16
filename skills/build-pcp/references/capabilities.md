# Capabilities

## Core

- Repository-owned persistent context.
- Thin root/platform routing into one canonical layer.
- Progressive exploration and grounded knowledge.
- Portable relative paths, numbered reading order, and discoverability.
- Stable human and agent identities, separate execution IDs, scoped reconciliation, and immutable ULID events.
- A bounded 64-event active window with 32-event archive rotation and explicit-only archive reads.
- Preview/digest mutation plans, validation, transactions, rollback, repair, and upgrade.

## Optional modules

- `concurrent-execution-blocks` — Concurrent Execution Blocks backed by generic workstreams.
- `spec-driven-projects` — bounded specification and project-record scaffolds.
- `scratch-space` — a declared noncanonical root workspace and its promotion policy.
- `walkthroughs` — progressive, evidence-based walkthrough creation.
- Explicit `none`, `human-owned`, recommended `human-commit`, `agent-managed`, or complete `custom` VCS responsibility policy, including non-Git systems.

The recommended human-commit flow lets the agent prepare and verify each coherent unit, then stops with the exact diff evidence and signed-commit commands. The human reviews, stages, and commits; the agent accepts that report and continues. PR use is recommended, never imposed, and all responsibilities remain project-configurable.

During adoption, put the exact desired capability IDs in the external input's `capabilities` array. Use `[]` for core only. The engine rejects unknown and duplicate IDs, resolves dependencies, installs overlays in canonical order regardless of input order, updates each affected numbered index, and records the normalized selection in `.pcp/pcp.yaml`. Capability files participate in the same preview digest, collision checks, transaction, rollback, clean-genesis validation, and State A/B/C rules as core files. A root-path collision blocks the plan; do not overwrite project material to force a module.

Enable only modules that fit the project. Installing PCP must not force a software topology or Git workflow on non-software and existing projects. Capability selection is part of adoption rather than an informal copy operation. Upgrade preserves the installed selection, refreshes release-owned capability protocol files, and leaves project-owned capability scaffolds and working material unchanged. If a later capability change is needed, treat it as a separately designed preview/apply lifecycle; do not edit the manifest or copy overlays manually.

## Compatibility

The `0.1.0` compatibility contract targets Codex, Antigravity, Claude Code Desktop, GitHub Copilot in Visual Studio Code, and Cursor IDE. Every adoption state generates and transactionally validates thin delegations for all five from canonical PCP state. Copilot receives root `AGENTS.md` plus `.github/copilot-instructions.md`; Cursor receives the same root entry plus an always-applied `.cursor/rules/pcp.mdc`. State C preserves existing scoped instructions through an explicit collision plan and fails closed when a foreign platform has no implemented replacement. Do not claim platform support until its fresh-agent reconstruction gate passes, and never let an adapter become a second authority.
