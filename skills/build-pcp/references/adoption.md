# Adoption

## Classify first

Run the bundled or installed engine's read-only inspection and review its structured evidence before selecting an adoption path:

```text
node <pcp-engine> inspect <candidate-directory> --json
```

Inspection must report `mutated: false`. Review its state, confidence, signals, exclusions, foreign candidates, ambiguities, normalized fingerprints, nested-repository boundaries, symlink boundaries, and inventory digest. Do not override a classification from a filename alone.

1. Route a valid existing PCP manifest to managed status, validation, repair, or upgrade.
2. Select State C when persistent non-PCP agent instructions, memory, identity, history, planning, workflow, or orchestration exists.
3. Otherwise select State B when substantive project assets exist.
4. Select State A only when the target is genuinely a seed or greenfield project.

State C takes precedence. Ambiguous State A/B input becomes State B. A README that merely discusses AI is not a foreign context layer.

## State A

- Preserve the original seed text.
- Determine the actual project type; do not assume software.
- Resolve indispensable product, stack, license, and deployment choices before scaffolding them.
- Create only the appropriate initial project structure and PCP baseline.

## State B

- Preserve project-owned structure.
- Explore progressively: manifests and structure, interfaces and contracts, then targeted high-value implementation.
- Generate grounded current-state knowledge from actual evidence.
- Record incompleteness and uncertainty rather than inventing detail.

## Prepare the semantic input

Run `adopt` once without an input to obtain structured questions and evidence groups:

```text
node <pcp-engine> adopt --candidate <candidate-directory> --json
```

Create a temporary YAML or JSON document outside the candidate that validates against `assets/schemas/v1/adoption-input.schema.json`. Do not leave this transient synthesis artifact in the project. It must contain:

- the baseline timestamp, persistence profile, explicit supported capability selection (an empty array means core only), schema-valid primary project state, grounded related-project registry and workstreams, and explicit VCS policy;
- exactly the five canonical knowledge documents and three operations documents named by the schema;
- each document's canonical type/status, evidence basis, cited candidate-relative paths, and grounded Markdown body;
- State A scaffold files only when they are explicitly appropriate; an empty State A target requires at least one;
- an empty `scaffold_files` array for State B;
- for State C, an empty `scaffold_files` array plus the completed coverage matrix emitted for the current candidate inventory.

Use `tracked` unless the candidate's existing ignore policy already covers the complete `.pcp/` layer. The engine rejects a `local` persistence claim that is not actually ignored and rejects tracked adoption into an ignored canonical path.

Use `repository` or `repository-and-user` only with cited paths from the engine inventory. Every State B knowledge document must use one of those repository-grounded bases. Use `user` for explicit current direction and `not-applicable` only when the document says why. Preserve uncertainty; never fill a baseline with guesses or template placeholders.

The singular `project` record is the adopted primary project. The `projects.projects` array contains only additional related or nested projects; do not duplicate the primary project there. Use an empty array when no secondary project is established by evidence.

For State A software, resolve the actual language, runtime, package manager, license, and deployment choice before encoding any related scaffold. For non-software work, create only the structure appropriate to its real project type.

## Preview and apply

Generate the normalized, non-mutating plan with the completed external input:

```text
node <pcp-engine> adopt --candidate <candidate-directory> --input <temporary-input> --json
```

Review every operation and present the returned `plan_digest` for approval. Apply only that exact plan with the same input:

```text
node <pcp-engine> adopt --candidate <candidate-directory> --input <temporary-input> --apply <plan-digest> --json
```

The engine fully recomputes the plan, rejects source drift, acquires a project lock, stages content outside the candidate, writes a preimage-backed operation log, applies atomically, validates the live clean genesis, rolls back exact source hashes on failure, and removes recovery material after success. Every State A/B/C plan includes the five canonical thin adapters and the exact checked engine at `.pcp/tools/pcp.mjs` with its adjacent SHA-256. Their target paths are reserved; do not use a State A scaffold to create independent platform instructions. Never bypass a digest mismatch or retained-recovery warning with shell writes.

## State C

- Perform State B exploration against the real project first.
- Discover foreign context by semantics, not directory name.
- Translate useful current facts, decisions, rationale, rules, projects, and workstreams.
- Do not import actor profiles, synchronization cursors, or historical events.
- Require complete file and history coverage before planning any foreign removal.
- Mark an ordinary file `project-owned` only when cautious directory expansion found it beside foreign context; leave it unchanged and give it no canonical target.

Run `adopt` without input to obtain the transient matrix, then include the completed matrix as `coverage` in the external State C semantic input. A successful review reports `coverage_status: complete` and emits an applicable normalized plan whose digest binds coverage, canonical writes, generated platform adapters, preimages, and removals. Review every adapter `write`, `replace`, and legacy removal. PCP plans the replacement before removing a supported scoped convention and blocks any adapter surface outside the implemented five-product contract. Apply only the approved digest through the engine using the command above. Do not reproduce the plan with manual file operations: the engine must recheck the inventory, validate the live canonical layer and adapters, and restore exact preimages on failure.

## Clean genesis

Every successful adoption has zero actor profiles, zero active events, and zero archived events. Adoption, installation, migration, and registration do not create events. The first meaningful later change becomes the first continuity event; its ULID provides ordering without a shared sequential counter.
