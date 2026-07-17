# PCP 0.1.0 release candidate

The reproducible candidate identity lives in [`release/0.1.0-rc.json`](../release/0.1.0-rc.json). It records every Git-known source path and byte digest except its own generated file, the combined source-tree digest, the byte-identical engine digest, the packaged skill size, the skill-assets manifest digest, and the verification contract.

The candidate is frozen only when all of these conditions hold on the exact manifest identity:

1. `npm ci && npm run verify` passes from a fresh dependency state.
2. The package-content and private-data scans pass after build and skill packaging.
3. The complete packaged-engine lifecycle golden test passes.
4. GitHub passes `verify` and `golden` on both Ubuntu and Windows plus aggregate `test`.
5. The candidate working tree contains no further planned public source change.

The merge commit supplies the VCS identity after review. The manifest supplies a reproducible content identity before that commit exists and avoids a self-referential commit hash.

## Public acceptance audit

| Contract             | Current evidence                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public scaffold      | `package.json`, `package-lock.json`, CI, Apache-2.0 `LICENSE`, and `tests/contract/project.test.ts` enforce the Node 24/npm project boundary.                                                        |
| Open skill           | `skills/build-pcp/`, `scripts/validate-skill.mjs`, skill contracts, package audit, checksums, and independent bundled execution cover the distributed skill.                                         |
| Three-state intake   | Inspection, adoption planner/transaction tests, State C coverage tests, and the FlowForge State B example cover managed and A/B/C routing.                                                           |
| Clean genesis        | Canonical validation, adoption transaction tests, and distribution verification require empty actors, active events, and archive at adoption.                                                        |
| Mutation safety      | Digest-bound preview/apply, path and source checks, locks, write-ahead transactions, injected-failure tests, exact rollback, and actionable recovery locations cover structural safety.              |
| Canonical validation | Versioned schemas and validation contracts cover structure, numbered indexes, links, ownership, portability, secrets, adapters, actors, events, checkpoints, workstreams, and generated projections. |
| Five adapters        | Adapter manifests, reconstruction tests, compatibility guidance, and golden adoption cover Codex, Antigravity, Claude Code Desktop, GitHub Copilot in VS Code, and Cursor.                           |
| Capability parity    | `docs/capability-parity.yaml`, its readable matrix, and contract tests give evidence for every preserved or superseded behavior.                                                                     |
| FlowForge            | `examples/flowforge/` and its integration contract prove source-only State B adoption without copied history, identities, build output, or private data.                                             |
| Publication privacy  | The repository scan, allowlisted package audit, synthetic fixtures, CI matrix, and private-data contract cover the public source and generated package boundary.                                     |

The private `rise` conversion criteria are intentionally not claimed here. File-and-entry coverage, master-plan absorption, live foreign-layer removal, empty post-cutover continuity, and independent reconstruction belong to the later dogfood staging and cutover milestones. A defect found there is a PCP defect: stop, explicitly unfreeze this candidate, fix the public source, regenerate the manifest, and repeat every gate before resuming conversion.

## Reproduce or invalidate the identity

Verify without changing the candidate:

```powershell
npm run verify:candidate
```

After an intentional public-source change, the candidate is no longer frozen. Review and verify the change first, then generate a new identity deliberately:

```powershell
npm run freeze:candidate
npm run verify
```

Do not regenerate the manifest merely to make an unexplained diff pass.
