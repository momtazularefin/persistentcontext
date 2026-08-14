# Capabilities

## Core

- Repository-owned persistent context and one canonical entry.
- Generated mandatory adapters for five agent products.
- Progressive exploration and grounded agent-operational knowledge, plus an external project-document registry.
- Portable paths, numbered reading order, and discoverability.
- Stable human and agent identities, fresh per-chat execution IDs, global mandatory synchronization, and immutable ULID events.
- A bounded 64-event active window with 32-event archive rotation and explicit-only archive reads.
- Flat descriptive workstreams with evidence-backed completion.
- Preview/digest plans, validation, transactions, rollback, repair, and upgrade.

PCP intentionally does not provide CEBs, dependency graphs, impact inference, or dependency-sensitive synchronization.

## Optional modules

- `spec-driven-projects` — bounded specifications created under each project's configured external documentation root and tracked from `.pcp/state/documentation.yaml`.
- `scratch-space` — a declared noncanonical workspace and promotion policy.
- `walkthroughs` — progressive evidence-based walkthrough creation.

VCS responsibility is core policy rather than a capability. It supports `none`, `human-owned`, recommended `human-commit`, `agent-managed`, or a complete `custom` map, including non-Git systems.

Put the exact desired capability IDs in adoption input. Use `[]` for core only. The engine rejects unknown or duplicate IDs, installs overlays in canonical order, updates indexes, and records the normalized selection in `.pcp/pcp.yaml`. Capability assets participate in the same preview digest, collision checks, transaction, rollback, and clean-genesis validation as core files. Do not copy overlays or edit the manifest manually.

The release bundles capability metadata in the executable so an installed engine validates selected modules without the public checkout. Adoption and upgrade use the incoming release's checked overlay assets. Upgrade preserves the installed selection and project-owned module content.

## Compatibility

The `0.2.0` adapter contract supports Codex, Antigravity, Claude Code Desktop, GitHub Copilot in Visual Studio Code, and Cursor through product-native project instruction conventions. Each generated surface mandates per-request global sync and delegates durable authority to `.pcp/00-index.md`. Cursor receives an always-applied rule; Claude receives an explicit canonical-file reference; Copilot receives workspace custom instructions; Codex uses `AGENTS.md`; Antigravity uses a workspace rule.

The reconstruction gate proves that every declared surface reaches the same canonical state. This does not imply interactive certification, an unbypassable runtime hook, or guaranteed model obedience. Never let an adapter or optional platform hook become a second context authority.
