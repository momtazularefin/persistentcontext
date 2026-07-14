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

- Concurrent Execution Blocks backed by generic workstreams.
- Spec-driven project records: analysis, specification, design, tasks, decisions, and evaluation.
- Scratch-space policy.
- Progressive walkthrough creation.
- Explicit `none`, `human-owned`, recommended `human-commit`, `agent-managed`, or complete `custom` VCS responsibility policy, including non-Git systems.

The recommended human-commit flow lets the agent prepare and verify each coherent unit, then stops with the exact diff evidence and signed-commit commands. The human reviews, stages, and commits; the agent accepts that report and continues. PR use is recommended, never imposed, and all responsibilities remain project-configurable.

Enable only modules that fit the project. Installing PCP must not force a software topology or Git workflow on non-software and existing projects.

## Compatibility

The `0.1.0` compatibility contract targets Codex, Antigravity, Claude Code Desktop, GitHub Copilot in Visual Studio Code, and Cursor IDE. State C translation generates and transactionally validates thin delegations for all five from canonical PCP state. Copilot receives root `AGENTS.md` plus `.github/copilot-instructions.md`; Cursor receives the same root entry plus an always-applied `.cursor/rules/pcp.mdc`. Preserve existing scoped instructions through an explicit collision plan, and fail closed when a foreign platform has no implemented replacement. Do not claim platform support until its fresh-agent reconstruction gate passes, and never let an adapter become a second authority.
