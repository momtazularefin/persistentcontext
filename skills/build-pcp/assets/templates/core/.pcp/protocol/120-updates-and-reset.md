---
doc: protocol/120-updates-and-reset.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-08-15T02:38:23+06:00
ownership: protocol
---

# Upgrades and history reset

## Recognize an update request

A human actor may initiate PCP update discovery in ordinary language. Treat any clear request to update, upgrade, refresh, or check the installed PCP layer against its original GitHub source as authorization for a read-only update check, not as authorization to mutate the layer.

- The installed version authority is `protocol.version` in `.pcp/pcp.yaml`.
- The remote version authority is `protocol.version` in the canonical template manifest at a snapshot of the configured GitHub `main` source.
- Run `node .pcp/tools/pcp.mjs upgrade . --check --json`. Report `update_available` deterministically from semantic-version comparison.
- The check returns the exact immutable source revision and bundle URL. Branch movement, commit date, package cache, or agent memory without a manifest version change is not an update.
- Network failure, an invalid response, or a source mismatch is unknown availability, never evidence that the layer is current.

## Apply an available release

The installed engine belongs to the installed version and cannot supply newer assets. Download the immutable source-revision bundle named by the check result, verify the bundle's packaged checksums, and run the incoming engine against the managed project.

1. Preview `upgrade` with the incoming engine and review its plan digest, release-owned paths, mechanical migration paths, preservation digest, and agent migration instructions.
2. Apply only the matching fully recomputed digest. The command replaces protocol-owned files, generated projections, generated adapters, and any explicitly versioned mechanical migration paths. Untargeted project and runtime bytes are preserved and verified.
3. Never copy release templates over project-owned knowledge, operations, project records, documentation, or ordinary source files. Use `agent_migration.review_paths` to inspect the updated protocol together with current source code and project documents, then rewrite only project-derived records that require semantic change.
4. Render generated views and validate the complete layer with the commands returned under `agent_migration.completion_commands`. Record a meaningful current-state change when appropriate.
5. Only after deterministic apply, required semantic review, rendering, and validation have completed is the PCP update complete.

## Offer an optional history purge

After a completed version update, ask the human actor whether to purge PCP actor and continuity history. This is a separate destructive choice; never infer confirmation from the original update request, silence, or an ambiguous reply.

If the human explicitly agrees:

1. Run `node .pcp/tools/pcp.mjs purge-history . --json` and show the exact paths, counts, warning, and plan digest.
2. Apply only the matching recomputed digest with `node .pcp/tools/pcp.mjs purge-history . --apply <plan-digest> --json`.
3. Confirm clean-genesis validation. Do not create a continuity event for the purge.
4. Discard any conversation-cached actor ID. Registration on the next project request creates a fresh actor identity and execution ID.

The purge transaction removes durable actor profiles, active continuity events, archived events, per-execution checkpoints, and local actor identity caches. It preserves the current protocol, agent-operational knowledge, project state, outcome documentation, source code, VCS policy, and Git repository history. Source and current canonical documents remain the ground truth.
