---
name: build-pcp
description: Adopt and maintain Persistent Context Protocol (PCP) in seed, established, or foreign-context-layer projects. Use when an agent needs to inspect or classify a repository for PCP, preview or apply adoption, migrate an existing AI/agent memory layer, register or reconcile project actors, validate or render .pcp state, record a meaningful change, manage workstreams or CEBs, repair drift, or upgrade PCP.
---

# Build PCP

Build and maintain repository-native persistent project context with semantic agent judgment and the bundled deterministic `pcp` engine.

## Route the request

- Read [references/adoption.md](references/adoption.md) for inspection, classification, preview, or first adoption.
- Read [references/operation.md](references/operation.md) for registration, status, reconciliation, event recording, rendering, and workstreams.
- Read [references/migration-and-repair.md](references/migration-and-repair.md) for foreign-layer translation, destructive apply, repair, rollback, or upgrade.
- Read [references/capabilities.md](references/capabilities.md) when selecting optional modules or checking feature parity.

Load only the references required for the requested lifecycle operation.

## Resolve the engine

1. Prefer `<project-root>/.pcp/tools/pcp.mjs` when a valid managed installation exists.
2. Otherwise use `scripts/pcp.mjs` from this skill.
3. Verify the adjacent `pcp.sha256` before structural work when the bundled engine is used.
4. Verify `assets/pcp-assets.sha256` before using bundled schemas or templates.
5. Run the engine with Node.js 24 or a compatible version declared by the installed manifest.
6. Stop if no verified engine is available. Do not reproduce structural operations with improvised shell commands.

## Preserve responsibility boundaries

- Use agent reasoning for repository exploration, seed interpretation, knowledge synthesis, conflict resolution, and history dispositions.
- Use the engine for inventory, hashes, schemas, path boundaries, normalized plans, locks, transactions, rendering, and mechanical validation.
- Canonicalize the project context layer only. Preserve ordinary source, deployment, data, documentation, and assets unless the user separately requests changes.
- Treat current explicit user direction and verifiable project state as stronger than stale foreign context.

## Apply the lifecycle guardrails

1. Inspect before proposing structural work.
2. Explain the detected state and supporting evidence.
3. Build the complete semantic coverage required by that state.
4. Run preview and present the exact normalized mutation plan.
5. Apply only the approved digest after the engine rechecks fingerprints.
6. Validate the live result and required clean-genesis or ongoing-state invariants.
7. Remove recovery material only after successful acceptance.

Never delete foreign context while any file, history entry, collision, or conflict remains unresolved.

## Fail closed during development

`inspect`, State A/B/C `adopt`, `register`, `status`, `record`, `validate`, `render`, and `workstream` are available. Adoption is preview-only unless the exact recomputed plan digest is supplied with the same external semantic input; `render` may replace only the declared generated status view. `register` requires a valid installed layer, recovers a durable profile before creating one, keeps its cache under ignored runtime ownership, returns a separate execution ULID, and never creates an event. `status` is read-only unless the caller supplies its exact recomputed acknowledgement digest after absorbing the reported context; acknowledgement changes only one ignored checkpoint and never creates an event. `record` accepts one external schema-valid description of a meaningful change, preserves performer and recorder attribution, and transactionally appends one immutable event under the continuity lock. `workstream` binds every mutation to the exact current registry digest and atomically updates the registry, generated status view, and attributed event. These ordinary operations inspect archive filenames but do not read archive contents. State C becomes applicable only after complete coverage review and emits a coverage-bound operation plan with deterministic adapters for the five declared platform targets. Apply must run through the engine so its lock, preimages, live validation, and exact rollback remain effective. An unimplemented adapter surface blocks the plan. `upgrade` and `repair` return `PCP_OPERATION_UNAVAILABLE`. Do not simulate an unavailable operation or mutate the target around the engine.

## Report evidence

Summarize the detected state, plan digest, validation result, clean-genesis counts when adopting, and any retained limitation. Do not expose secrets, private context, preimages, or local machine paths.
