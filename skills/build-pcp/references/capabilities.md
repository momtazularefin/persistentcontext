# Capabilities

## Core

- Repository-owned persistent context.
- Thin root/platform routing into one canonical layer.
- Progressive exploration and grounded knowledge.
- Portable relative paths, numbered reading order, and discoverability.
- Stable agent identities, separate execution IDs, scoped reconciliation, and immutable ULID events.
- Preview/digest mutation plans, validation, transactions, rollback, repair, and upgrade.

## Optional modules

- Concurrent Execution Blocks backed by generic workstreams.
- Spec-driven project records: analysis, specification, design, tasks, decisions, and evaluation.
- Scratch-space policy.
- Progressive walkthrough creation.
- Explicit `none`, `human-owned`, recommended `agent-managed`, or complete `custom` VCS responsibility policy.

The recommended agent-managed flow keeps verified unit commits local, pushes and opens one PR at a substantial milestone, leaves review and merge to the human, then gives the agent responsibility for verified post-merge synchronization and the next branch.

Enable only modules that fit the project. Installing PCP must not force a software topology or Git workflow on non-software and existing projects.

## Compatibility

Generate thin adapters for Codex, Antigravity, and Claude Code Desktop from canonical PCP state. Preserve existing scoped instructions through an explicit collision plan. Never let an adapter become a second authority.
