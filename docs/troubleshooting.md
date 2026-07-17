# Troubleshooting

PCP fails closed and reports stable error codes. Start with structured output, preserve recovery evidence, and fix the concrete boundary rather than bypassing validation.

## First response

1. Stop repeating a mutating command until its result is understood.
2. Rerun the corresponding preview or read-only operation with `--json`.
3. Record the `code`, `message`, `mutated`, `recovery_retained`, and `recovery_path` fields from stderr.
4. Confirm the candidate path, current branch or backup state, Node version, and whether another PCP process is active.
5. If `mutated` or `recovery_retained` is true, preserve the project and recovery material before attempting repair.

Example:

```powershell
node dist/pcp.mjs validate path/to/project --json
node dist/pcp.mjs inspect path/to/project --json
```

Do not use force deletion, `git reset --hard`, `git clean -fd`, manual event rewriting, checksum editing, or policy weakening as generic recovery steps.

## Environment and build

### Unsupported Node or inconsistent dependencies

Confirm Node.js `>=24 <25` and the locked npm version:

```powershell
node --version
npm --version
npm ci
npm run verify
```

Use `npm ci`, not an incidental dependency upgrade. If generated engines or skill assets differ, edit the authoritative `src/`, `schemas/`, or `templates/` source and rerun `npm run build` followed by `npm run package:skill`. Do not patch the generated copy or checksum.

### Formatting, lint, or type failures

Run the failing stage directly:

```powershell
npm run format:check
npm run lint
npm run typecheck
```

Use `npm run format` only when the complete resulting diff is in scope. A type or lint failure should be fixed in source, not suppressed globally to unblock an unrelated change.

## Inspection and classification

| Error or symptom              | Meaning                                                             | Safe response                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PCP_UNSAFE_ROOT`             | The candidate is a filesystem root or otherwise forbidden boundary. | Select the exact project directory; never adopt a drive, home, or broad parent directory.                                                                                          |
| `PCP_CANDIDATE_NOT_DIRECTORY` | The candidate is not a directory.                                   | Correct the path and inspect again.                                                                                                                                                |
| `PCP_CANDIDATE_UNREADABLE`    | Inventory cannot read the candidate safely.                         | Check permissions and path existence without broadening access beyond the intended project.                                                                                        |
| `PCP_SOURCE_CHANGED`          | Files changed after inventory or while an operation was prepared.   | Stop concurrent writers, rerun inspection/preview, and review the new digest.                                                                                                      |
| Unexpected State A/B/C        | Evidence differs from the assumed project state.                    | Read classification signals and foreign candidates; do not force a state label. Remove false-positive ordinary prose only by improving evidence or detection, not by hiding files. |

A valid existing PCP layer routes to managed lifecycle commands. A broken `.pcp/` may classify as foreign or invalid; run `validate` and repair the diagnosed canonical issue before attempting upgrade.

## Adoption input and planning

| Code family                                                                                     | Likely cause                                                                                        | Safe response                                                                                                            |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PCP_ADOPTION_INPUT_*`                                                                          | Missing, unreadable, oversized, symlinked, schema-invalid, or candidate-internal semantic input.    | Store a regular input file outside the candidate, validate every required field, and rerun preview.                      |
| `PCP_ADOPTION_EVIDENCE_MISSING`                                                                 | A repository-grounded document cites a path absent from the inventory.                              | Correct the evidence path or reground the document; do not change its basis to hide missing evidence.                    |
| `PCP_STATE_A_SCAFFOLD_REQUIRED`                                                                 | A clean seed lacks an approved initial scaffold.                                                    | Supply a project-type-appropriate explicit scaffold.                                                                     |
| `PCP_STATE_B_SCAFFOLD_FORBIDDEN`                                                                | Adoption tries to add ordinary files to an established project.                                     | Remove scaffold files; PCP must preserve the established project structure.                                              |
| `PCP_STATE_C_COVERAGE_REQUIRED` or `PCP_STATE_C_COVERAGE_INVALID`                               | Foreign context lacks complete reviewed coverage.                                                   | Rediscover coverage and resolve every file and entry against the current inventory.                                      |
| `PCP_STATE_C_ADAPTER_UNSUPPORTED`                                                               | A foreign adapter/capability has no implemented replacement.                                        | Preserve the project and stop translation until PCP supports that surface or the user explicitly removes it outside PCP. |
| `PCP_ADOPTION_PATH_*`, `PCP_ADOPTION_NESTED_REPOSITORY`, or `PCP_ADOPTION_PREIMAGE_UNSUPPORTED` | A target crosses ownership, path, symlink, nested-repository, collision, or replacement boundaries. | Correct the semantic target or project layout deliberately; never bypass the boundary check.                             |
| `PCP_ADOPTION_SCAFFOLD_SECRET`                                                                  | Scaffold content resembles secret material.                                                         | Remove the value, rotate it if real, and reference only the non-secret requirement.                                      |

Encrypted, binary, invalid UTF-8, unreadable, malformed structured, unrecognized, oversized, excluded, and symlinked foreign sources block State C removal. Convert or resolve them explicitly; do not mark unread material as represented.

## Preview and apply

### `PCP_PLAN_DIGEST_MISMATCH`

The supplied digest does not match the fully recomputed plan. Rerun preview with the same external input, compare classification, coverage, replacements, removals, and operations, then approve the new digest only after review. Never paste an old digest into a changed plan.

### `PCP_ADOPTION_LOCKED` or another `*_LOCKED` code

Another structural or continuity operation owns the project lock, or a recent process left a lock that has not met safe stale-lock recovery conditions. Confirm no PCP process is active. Retry after the active operation completes. Do not delete lock files merely because a command is inconveniently blocked.

### `PCP_ADOPTION_SPACE_INSUFFICIENT`

PCP cannot prove enough space for staging and preimages. Free space outside the candidate or move the project to an appropriate volume, then rebuild the preview. Do not disable preimages or rollback.

### Live validation or transaction failure

Codes such as `PCP_ADOPTION_LIVE_INVALID`, `PCP_ADOPTION_LIVE_MISMATCH`, `PCP_ADOPTION_TRANSACTION_FAILED`, and `PCP_ROLLBACK_VERIFICATION_FAILED` indicate that apply did not reach an accepted live result.

- If `mutated: false` and `recovery_retained: false`, the engine verified exact rollback.
- If recovery is retained, leave it intact and preserve the candidate. `recovery_path` gives its absolute location on the current machine; a rare nested failure also includes `recovery_paths` with every retained location. Inspect the reported project state and validation diagnostics before any manual action.
- If rollback verification failed, treat the project as requiring recovery from retained preimages, protected VCS, or an external backup. Do not rerun adoption over an unexplained partial state.

When no recovery material remains, `recovery_path` is `null`. The path is ephemeral diagnostic output: do not copy it into canonical `.pcp/` documents, continuity events, fixtures, issues, or commits. Retained structural folders use a `pcp-transaction-*` prefix under the operating-system temporary directory; event and workstream transactions use `pcp-event-transaction-*` and `pcp-workstream-transaction-*`.

## Canonical validation

`pcp validate --json` returns path-specific diagnostics. Fix the canonical owner named by each diagnostic:

- schema errors: correct the YAML record against its release schema;
- `path.*`: replace absolute paths or file URIs with portable repository-relative references;
- `secret.*`: remove and rotate real secrets, then audit VCS and logs;
- `ownership.*`: correct the manifest or misplaced file rather than broadening ownership blindly;
- `markdown.*`, `index.*`, or link errors: restore frontmatter, numbering, folder indexes, and root reachability;
- generated view drift: run `render --check`, review canonical sources, then run `render`;
- adapter drift: use `repair` preview instead of editing generated adapter files;
- event payload or duplicate-key errors: do not edit history in place; preserve evidence and record a later correction after resolving corruption;
- checkpoint, workstream, or VCS-policy errors: repair the authoritative state record and revalidate before continuing.

Full validation reads archive contents. `validate --archive-index-only` checks operational archive identities without treating archived prose as routine startup context.

## Registration and status

| Code                               | Safe response                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PCP_REGISTRATION_STALE_CACHE`     | Restore the matching durable profile or deliberately remove only the ignored local cache after confirming the profile is truly gone; then register again.           |
| `PCP_REGISTRATION_CACHE_MISMATCH`  | The requested identity conflicts with the cache. Confirm client, machine label, project path, and explicit actor ID; do not overwrite the durable profile.          |
| `PCP_REGISTRATION_AMBIGUOUS`       | More than one durable profile matches. Rerun with the intended explicit `--actor-id`.                                                                               |
| `PCP_REGISTRATION_ACTOR_NOT_FOUND` | The explicit actor ID is absent. Use an existing profile or register without claiming that ID.                                                                      |
| `PCP_STATUS_ACTOR_NOT_FOUND`       | Status requires a registered durable actor. Register first.                                                                                                         |
| `PCP_STATUS_WORKSTREAM_NOT_FOUND`  | The selected workstream is absent. Validate the registry and use its exact ID.                                                                                      |
| `PCP_STATUS_DIGEST_MISMATCH`       | Context changed or the acknowledgement digest is wrong. Read a fresh status preview and acknowledge only after absorbing it.                                        |
| `PCP_STATUS_CHECKPOINT_AMBIGUOUS`  | Multiple checkpoints match an invalid or conflicting local selection. Preserve files and inspect local checkpoint state; do not choose one by editing its contents. |

Registration and status should not create continuity events. If they do, validation should fail and the behavior should be reported as a defect.

## Event recording

| Code                                                                 | Safe response                                                                                                        |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PCP_RECORD_INPUT_*`                                                 | Use one regular schema-valid external input file outside the managed project.                                        |
| `PCP_RECORD_ATTRIBUTION_INVALID`                                     | Register the referenced actors and correct performer, recorder, and basis.                                           |
| `PCP_RECORD_DUPLICATE_CHANGE`                                        | The same reported/observed external change is already active. Do not create a prose variant; use the existing event. |
| `PCP_RECORD_ARCHIVE_COLLISION`                                       | Rotation would overwrite an archived identity. Preserve both histories and investigate corruption.                   |
| `PCP_RECORD_ROLLBACK_FAILED` or `PCP_RECORD_RECOVERY_CLEANUP_FAILED` | Preserve retained recovery evidence and stop recording until active/archive state validates.                         |

Never edit an accepted event or its payload digest. Record a later corrective event after canonical current state is fixed.

## Workstreams

| Code                                                                                               | Safe response                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PCP_WORKSTREAM_REGISTRY_CHANGED`                                                                  | Another operation changed the registry. Revalidate, rebuild the complete input against the new digest, and review again. |
| `PCP_WORKSTREAM_TRANSITION_INVALID`, `PCP_WORKSTREAM_TERMINAL`, or `PCP_WORKSTREAM_KIND_IMMUTABLE` | The requested lifecycle change is not allowed. Preserve terminal records and create new work when needed.                |
| `PCP_WORKSTREAM_DEPENDENCY_INCOMPLETE`                                                             | Complete and evidence every dependency first.                                                                            |
| `PCP_WORKSTREAM_EVIDENCE_*`                                                                        | Supply exactly one proof for each declared completion criterion and no unknown or duplicate proof.                       |
| `PCP_WORKSTREAM_ROLLBACK_FAILED`                                                                   | Preserve registry, view, event, and archive recovery evidence; validate before retrying.                                 |

Do not patch one field in place after a failed operation. Workstream mutations require a complete replacement record bound to the current registry digest.

## Repair and upgrade

### Repair

`PCP_REPAIR_NOT_APPLICABLE` means all five generated adapters already match; no apply is needed. `PCP_REPAIR_BLOCKED` means canonical state other than mechanically recoverable adapter drift is invalid. Fix that canonical source first. Collision and stale-plan errors require a fresh preview; repair never grants authority over project-owned files.

### Upgrade

- `PCP_UPGRADE_NOT_APPLICABLE`: the installation already matches the running release.
- `PCP_UPGRADE_DOWNGRADE_FORBIDDEN`: use a release at least as new as the installed protocol; PCP does not downgrade.
- `PCP_UPGRADE_CAPABILITY_UNSUPPORTED`: the incoming release cannot preserve an installed capability; do not remove it manually to force upgrade.
- `PCP_UPGRADE_OWNERSHIP_COLLISION` or `PCP_UPGRADE_COLLISION`: a desired release target conflicts with non-replaceable state; inspect ownership and preserve project data.
- `PCP_UPGRADE_ASSETS_MISMATCH` or `PCP_UPGRADE_SOURCE_INVALID`: rebuild or obtain a coherent release bundle; do not edit checksums.
- `PCP_UPGRADE_PRESERVATION_FAILED`: an untargeted or project/runtime-owned file changed. Preserve recovery evidence and investigate before retrying.

Repair and upgrade are preview-first. A no-op preview is success, not a reason to fabricate version drift.

## Platform adapter does not load

1. Run `pcp validate --json` to check the manifest and all adapters.
2. Confirm the product-specific target exists and points to `.pcp/00-index.md`.
3. If the generated file is missing or changed, run `pcp repair --json`, review the preimage-bound plan, and apply its digest.
4. Confirm the tool opened the project root containing both the adapter and `.pcp/`.
5. Check the [compatibility matrix](compatibility.md) and remember that adapter support does not certify every product UI or mode.

Do not create a second independent instruction layer as a workaround; that would reintroduce conflicting authority.

## When to report a defect

Open a normal issue with a minimal synthetic reproduction when a valid, supported operation returns the wrong safe refusal or an unclear diagnostic. Use private reporting under [SECURITY.md](../SECURITY.md) for mutation outside the approved project, uncovered deletion, rollback acceptance failure, secret/private-data exposure, policy bypass, or package-integrity failure.

Include PCP version or commit, OS, Node version, command, structured error, synthetic project shape, expected boundary, and focused/full test results. Never attach a real private repository, credential, identity cache, event history, or recovery preimage.
