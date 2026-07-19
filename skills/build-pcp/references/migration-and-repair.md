# Migration, Repair, And Upgrade

## History dispositions

Assign every foreign file and history entry one transient disposition:

- `represented`: current knowledge already exists in a cited canonical target.
- `promoted`: useful current knowledge or rationale is added to a cited target.
- `relocated`: one reviewed regular file is moved byte-for-byte to one new project-owned path outside `.pcp/` and every translated root.
- `superseded`: stronger current evidence replaces it.
- `operational-noise`: bookkeeping has no enduring value.
- `historical-only`: completed activity does not define current state.
- `sensitive-local`: omit a secret/private value or convert it to a safe current statement.
- `project-owned`: preserve an ordinary repository file that cautious foreign-layer discovery included only because it shares a directory with context material.
- `unresolved`: meaning, conflict, or target is unknown.

Block deletion while any item is unresolved. Do not use timestamps alone to resolve meaning.

## Preview and apply

1. Inventory and fingerprint without mutation.
2. Stage the complete target and semantic coverage.
3. Validate schemas, links, numbering, privacy, collisions, and clean-genesis rules.
4. Present the normalized plan and digest.
5. Apply only that digest after acquiring a lock and rechecking every fingerprint.
6. Create exact preimages and a write-ahead operation log outside canonical state.
7. Validate live output; restore exact preimages in reverse order on failure.
8. Remove recovery and transient coverage data only after acceptance.

Abort on source drift, unsafe symlinks, nested-boundary violations, insufficient permissions or space, unreadable material, or unresolved semantic conflict.

State C becomes applicable only after the engine accepts complete reviewed coverage and presents the normalized plan, including the five generated platform adapters, every collision, reviewed relocation, and derived empty-directory cleanup. Apply its approved digest only through the engine; never reproduce its replacement or removal operations manually, and never reproduce its `move` or `rmdir` operations separately. The transaction rechecks source fingerprints, validates the live canonical layer and adapters, and restores exact preimages and directory inventory in reverse on failure. If the engine reports an unsupported adapter surface, preserve it and add an explicit implementation rather than treating another platform's adapter as equivalent.

## Repair and upgrade

Repair only mechanically recoverable generated-adapter drift. Preview without mutation:

```text
node <pcp-engine> repair <project-root> --json
```

If `applicable` is true, review every operation and apply only the returned digest:

```text
node <pcp-engine> repair <project-root> --apply <plan-digest> --json
```

The engine refuses unrelated canonical damage, manifest/source drift, symbolic links, and file/directory collisions. It binds replacements to exact preimages, writes missing adapters only through the structural transaction, validates the complete live layer, and restores every byte after a caught failure. Use `render` for generated status-view drift.

Run upgrade with the incoming release's verified bundled engine, which carries the matching release template and capability assets. The engine already installed under the managed project's `.pcp/tools/` is for that installed release and cannot supply a newer release's assets. Preview the ownership-aware upgrade, review its target paths and preservation digest, then apply only the exact plan:

```text
node <pcp-engine> upgrade <project-root> --json
node <pcp-engine> upgrade <project-root> --apply <plan-digest> --json
```

Upgrade merges the installed persistence mode, capabilities, adapter contract, and VCS-policy path into the release manifest. It may replace only release protocol files, generated views, and generated adapters. It rejects a newer installed version, invalid source state, project/runtime ownership collisions, unsafe paths, or stale approval. Apply holds continuity and structural locks, validates the live result, and verifies the precomputed hash of every untargeted inventory file plus every project/runtime-owned canonical file. Never use upgrade to rewrite knowledge, policies, projects, workstreams, profiles, events, checkpoints, runtime caches, or ordinary project assets.

When the installed and bundled release versions and bytes already match, preview returns `applicable: false` with no plan digest. Treat that as a successful current-state check; do not fabricate an older version or force an apply.
