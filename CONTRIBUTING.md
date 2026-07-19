# Contributing

Persistent Context Protocol is developed through small, evidence-backed changes. A contribution should make one protocol behavior clearer, safer, or more useful and include direct proof for the boundary it changes.

## Before starting

- Read the [architecture](docs/architecture.md), [lifecycle](docs/lifecycle.md), [compatibility matrix](docs/compatibility.md), and [safety model](docs/safety.md).
- Use Node.js `>=24 <25` and npm `11.16.0`.
- Start from a clean branch based on current `main`.
- Search existing issues and pull requests before duplicating work.
- For a vulnerability or private-data exposure, stop and follow [SECURITY.md](SECURITY.md) instead of opening a detailed public issue.

PCP is pre-`1.0.0`, but compatibility and safety changes still require explicit rationale. Discuss broad schema, lifecycle, persistence, adapter, or ownership changes before building a large patch.

## Set up locally

```powershell
npm ci
npm run verify
node dist/pcp.mjs --help
```

`npm ci` must use the committed lockfile. Do not update dependencies incidentally in an unrelated change.

## Source-of-truth boundaries

Edit the authoritative source, not a generated copy:

| Change                        | Authoritative source                                         | Generated or checked projection                                    |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Engine behavior               | `src/`                                                       | `dist/pcp.mjs`, skill engine, installed template engine, checksums |
| Release schemas               | `schemas/`                                                   | `skills/build-pcp/assets/schemas/`                                 |
| Core and capability templates | `templates/`                                                 | `skills/build-pcp/assets/templates/`                               |
| Skill instructions            | `skills/build-pcp/SKILL.md` and its non-generated references | Packaged skill structure                                           |
| Public claims                 | `README.md`, `docs/`, `SECURITY.md`, `CONTRIBUTING.md`       | Documentation contract tests                                       |

`npm run build` bundles and synchronizes the installed engine. `npm run package:skill` copies the built engine, schemas, and templates into the skill and regenerates checksum manifests. `npm run verify` performs both operations and then proves the copies are byte-identical and independently executable.

Do not hand-edit synchronized engine files, checksum manifests, or `skills/build-pcp/assets/`. Review their generated diff after changing an authoritative source.

## Choose the right test level

| Change                    | Minimum direct evidence                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure domain rule          | Focused unit tests for accepted and rejected values.                                                                                                          |
| Filesystem mutation       | Transaction tests, source/preimage drift, live validation, and rollback at every new operation boundary.                                                      |
| Schema                    | Valid fixture plus at least two meaningful invalid cases with path diagnostics.                                                                               |
| State A/B/C adoption      | Classification, preview immutability, applied result, project-file preservation, and clean genesis.                                                           |
| State C translation       | Complete file/entry dispositions, unsupported-surface refusal, staged target and relocation validation, removal/empty-directory ordering, and exact rollback. |
| Continuity or workstreams | Attribution, locking, digest staleness, atomic state/event updates, and rollback.                                                                             |
| Platform adapter          | Product convention, manifest/source/content digest, collision behavior, repair, and canonical reconstruction.                                                 |
| Packaging                 | Source/asset equality, checksums, installed-engine execution, and private-data scan.                                                                          |
| Documentation             | Claim-specific contract assertions and local-link reachability.                                                                                               |

Tests should exercise the public invariant, not implementation trivia. Keep fault-injection and safe-refusal coverage exhaustive when adding a mutation boundary. Never raise timeouts, weaken assertions, reduce concurrency, or disable a platform merely to hide a deterministic failure; document and justify a platform-specific timing budget when the behavior itself remains unchanged.

## Fixtures and privacy

Use synthetic names, identities, histories, paths, credentials, and repository content. Never copy private project context into public tests, snapshots, issue text, diagnostic examples, or migration fixtures.

Fixtures must not contain dependency folders, build output, real VCS histories, agent caches, recovery preimages, absolute machine paths, or live tokens. Binary and encrypted boundary tests should use minimal synthetic bytes. A secret-pattern test must use an unmistakably fake value that cannot authenticate anywhere.

Run `npm run scan:private` before handing off any fixture or documentation change. This repository scan is a project-specific publication guard, not a substitute for reviewing the diff or using a dedicated secret scanner.

## Development checks

Use focused commands while iterating:

```powershell
npm run format:check
npm run lint
npm run typecheck
npx vitest run tests/unit/relevant-test.test.ts
npm run scan:private
```

Before requesting review, run the full gate:

```powershell
npm run verify
git diff --check
git status --short
```

The full gate checks formatting, lint, strict types, coverage, build, skill packaging and validation, an allowlisted package-content and checksum audit, private-data leakage, distribution integrity, and the installed-engine lifecycle golden test. CI runs the quality and publication scans on both Windows and Ubuntu, then requires a separate packaged lifecycle golden job on both systems before the aggregate `test` check can pass. Review all generated changes and confirm the worktree contains only the intended contribution.

## Commit and pull-request style

Prefer small Conventional Commit subjects that describe the outcome naturally, for example:

```text
fix: preserve project files during adapter repair
test: prove adoption rolls back after validation failure
docs: explain local persistence boundaries
```

A pull request should include:

- the problem and user-visible protocol behavior;
- why the chosen boundary belongs in PCP;
- compatibility, ownership, persistence, and security impact;
- changed schemas, templates, generated assets, or adapters;
- exact focused and full verification commands and results; and
- any intentionally deferred behavior or unverified platform claim.

Keep documentation claims in the same change as their implementation. Treat schemas, adapters, fixtures, templates, skill assets, ownership patterns, event semantics, and upgrade targets as compatibility-sensitive.

Do not weaken preview, source fingerprints, coverage, preimages, locks, rollback, clean genesis, ownership preservation, VCS authority, or secret/path checks to make a pull request pass. A safe refusal is part of the product contract.

## Review checklist

- [ ] The change has one coherent purpose.
- [ ] The authoritative source—not only a generated copy—was edited.
- [ ] Direct tests cover success, stale input, unsafe input, and caught failure where applicable.
- [ ] Project-owned and unknown files remain preserved unless an explicit reviewed contract says otherwise.
- [ ] Public claims distinguish verified behavior from assumptions and future intent.
- [ ] Fixtures and output contain no private data, real credentials, or machine-specific paths.
- [ ] `npm run verify` and `git diff --check` pass.
- [ ] Generated engine, assets, and checksum changes are understood.
- [ ] The pull request explains compatibility and security impact.
