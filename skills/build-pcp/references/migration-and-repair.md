# Migration, Repair, And Upgrade

## History dispositions

Assign every foreign file and history entry one transient disposition:

- `represented`: current knowledge already exists in a cited canonical target.
- `promoted`: useful current knowledge or rationale is added to a cited target.
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

State C becomes applicable only after the engine accepts complete reviewed coverage and presents the normalized plan, including the five generated platform adapters and every collision. Apply its approved digest only through the engine; never reproduce its replacement or removal operations manually. The transaction rechecks source fingerprints, validates the live canonical layer and adapters, and restores exact preimages in reverse on failure. If the engine reports an unsupported adapter surface, preserve it and add an explicit implementation rather than treating another platform's adapter as equivalent.

## Repair and upgrade

Repair only mechanically recoverable drift and always preview structural writes. During upgrade, replace protocol-owned and generated files only. Preserve project-owned knowledge, policies, projects, workstreams, profiles, and events.
