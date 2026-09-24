# Changelog

All notable public protocol changes are documented here from the first release candidate onward.

## Unreleased — 0.3.2 — Antigravity always-on rule

- Adapter validation now rejects a symlink or junction in any parent directory of a generated adapter. Previously a matching adapter file reached through an out-of-project parent could pass direct adapter validation; a regression test covers the boundary.
- Public release status no longer treats a candidate manifest as proof of GitHub publication. The separate `release/latest-published.json` record identifies the latest confirmed published release, while the candidate manifest remains a source-content identity.
- The adoption capability question no longer offers Concurrent Execution Blocks. `0.2.0` removed that capability and the input schema rejects it, but the question was prose and kept advertising it, so `adopt` solicited a selection the engine would refuse. The prompt is now generated from the same list the schema enum mirrors, names the capability IDs a caller must actually supply, and a test reads the list back out of the prompt and requires it to equal the schema enum.
- The Antigravity adapter `.agents/rules/pcp.md` now opens with `trigger: always_on` frontmatter. Antigravity loads a workspace rule unconditionally only when it sets that trigger, according to its built-in customization documentation. Without it, the adapter had never been loaded, and Antigravity confirmed that the shared `AGENTS.md` was the only PCP instruction it received. That is why, before `0.3.0`, it registered as Codex. The adapter now reaches Antigravity directly, and both files it loads agree on its identity.
- The adapter unit test and the reconstruction test require the frontmatter to open the file; both fail if it is removed.
- An installation from `0.3.1` upgrades by regenerating this one adapter. This is the first release whose upgrade changes adapter text, and pre-upgrade validation now judges older installations' adapters by structure (`0.3.0`), so the upgrade proceeds.

## 0.3.1 — 2026-09-21 — immutable history and upgrade guidance

- Full validation no longer demands portability from archived events. An event admitted under a weaker engine could never be corrected once archived, so full validation failed permanently, and the only ways out were purging all history or editing the archive or engine. Portability is still enforced on every active event and every current record. Because events reach the archive only by rotating out of the active window, the change admits nothing new. Archived events are still checked for schema, integrity, duplicate change keys, and secrets.
- Running `upgrade` with an installed project engine now fails as `PCP_UPGRADE_ASSETS_MISSING` and says to run the incoming release engine. It previously reported `PCP_UPGRADE_CAPABILITY_UNSUPPORTED`, which pointed at the project's capability selection instead of the actual cause. The golden lifecycle test now asserts this.
- `package-lock.json` had kept the root version `0.2.0` through the whole `0.3.0` release, because npm tolerates the mismatch. The single-version test now covers the lockfile.

## 0.3.0 — 2026-09-21 — deterministic identity

- Stopped the shared `AGENTS.md` adapter from assigning an identity. It carried `--client codex`, but Antigravity, Cursor, and GitHub Copilot in VS Code load it alongside their own adapters, so each received two PCP instructions that disagreed about who it was. Antigravity followed the shared file and registered as Codex. `AGENTS.md` now tells the running product to register with its own app label; each product-specific adapter names exactly one label and states that a shared file never overrides it. The reconstruction test now loads every file each product loads and fails if any of them names another product's label. It previously checked only that one of them was right.
- Fixed upgrades from an older release refusing to start whenever the incoming release changed adapter text. Pre-upgrade validation compared the installed adapters with what the incoming engine renders, which an older installation can never match, so every one of those upgrades failed on the files it existed to replace. An installation from an older release now has its adapters checked for set, targets, canonical source, and manifest IDs, and not content. Post-upgrade validation still compares content exactly, and a same-version installation is still checked exactly. Upgrade tests had only ever lowered the version number on current-release adapters; a new test upgrades the adapter bytes `0.2.0` actually rendered.
- Replaced every locale-sensitive ordering with a single code-unit comparator. ICU collation is host-dependent, so orderings that feed reproducible content digests or decide event recency previously gave one unchanged tree different identities on different machines.
- Made update discovery resolve the newest published GitHub release and pin its tag to an immutable commit, instead of reading the tip of `main`. Drafts, prereleases, and malformed tags are refused, so development is never advertised as an available update.
- Narrowed the context a sync requires an agent to read to what PCP governs: its own layer and the documents its registry catalogs. Each event continues to name its own affected paths, and paths that no longer exist are dropped.
- Normalized recorded event paths so `docs`, `./docs`, and `docs/` cannot appear as three separate places in one event.
- Stopped a failure while removing a completed transaction's write-ahead log from rolling back the event that transaction had already installed and validated.
- Gave the release version one authority, with a test that the package, engine constant, and installed manifest agree.

## 0.2.0 — 2026-08-15 — mandatory global synchronization

- Replaced scoped `status` with mandatory `sync` before every agent response or project-tool use.
- Keyed checkpoints by actor plus per-chat execution ID so simultaneous chats cannot consume one another's updates.
- Added a deterministic no-change fast path and agent-friendly plain-text change delivery with two-phase digest acknowledgement.
- Removed the Concurrent Execution Block capability, workstream dependency fields, dependency completion gates, and dependency-sensitive reconciliation.
- Kept flat sequential/concurrent work labels as optional descriptive lifecycle and evidence records only.
- Turned all five generated platform adapters into automatic operating contracts for registration, synchronization, acknowledgement, and fail-closed behavior.
- Evolved the newcomer prompt library into an adoption and recovery guide; normal managed-project use requires no pasted startup prompt.
- Added an ownership-aware 0.1 migration for CEB assets, CEB work labels, dependency fields, and obsolete scoped checkpoints.
- Separated agent-operational knowledge in `.pcp` from project-outcome knowledge in an established external documentation directory or default `docs/` root.
- Added per-project documentation-root state and a validated `.pcp/state/documentation.yaml` registry covering every ordinary project document, including related source paths and misplaced/stale-entry checks.
- Moved spec-driven project outcomes to tracked external documents and extended adoption and 0.1 migration to establish the new boundary without relocating existing documentation.
- Made new actor-ID prefixes predictable: canonical app labels use `antigravity`, `codex`, `claude`, `copilot`, `cursor`, or `human`, unknown apps use one lowercase word, and the machine label is derived automatically from the system hostname while legacy IDs remain immutable and recoverable.
- Added deterministic `upgrade --check` discovery that snapshots the canonical GitHub `main` revision, compares installed and remote manifest versions, and returns an immutable source bundle for available updates.
- Extended upgrade results to separate release-owned replacements, explicit mechanical migrations, and project-derived paths requiring agent semantic review against current source and documentation.
- Added separately confirmed, preview-first `purge-history` with exact rollback; it clears actor profiles, active and archived events, checkpoints, and identity caches while preserving current project truth and Git history.

## 0.1.0-rc — release candidate

- Clarified primary-versus-related project input and release-engine upgrade routing, and removed misleading synthetic timestamps from deterministic transient mutation plans.
- Proved that the documented startup surfaces for all five adapters reach one canonical entry and reconstruct identical project identity, purpose, lifecycle, workstream, VCS, overview, and next-action context.
- Made optional capability overlays explicitly selectable, transactionally installable, canonically indexed, validated, and upgrade-aware.
- Established the reproducible `0.1.0` project and open-skill scaffold.
- Added read-only repository inventory, SHA-256 fingerprints, boundary-safe traversal, and explainable managed/State A/State B/State C intake classification.
- Added versioned canonical schemas, a clean-genesis `.pcp/` baseline, four optional capability overlays, and explicit configurable VCS responsibility profiles.
- Added installed-layer validation for structure, YAML, numbered Markdown, links, portability, privacy, ownership, identities, workstreams, continuity events, checkpoints, generated digests, and clean genesis.
- Added deterministic `pcp validate` and `pcp render [--check]` commands plus self-contained skill schema/template assets.
- Added preview-first State A/B adoption with external grounded semantic inputs, normalized plan digests, source-drift rejection, project locks, write-ahead transactions, exact rollback, and clean-genesis validation.
- Replaced agent-only continuity with stable human and agent actors, minimal performer/recorder events, a 64-event active window, and 32-event explicit-only archive rotation.
- Added the recommended human-signed-commit profile while making pull requests optional policy and retaining human-owned, agent-managed, custom, non-Git, and no-VCS choices.
- Added deterministic State C foreign-source discovery with file, adapter, history-entry, and registry-entry coverage templates; duplicate timestamps do not act as identities, and unreadable, encrypted, binary, excluded, or malformed sources fail closed.
- Added non-mutating State C coverage review against the current inventory and staged canonical targets, including a `project-owned` disposition that preserves ordinary files caught by cautious discovery.
- Added normalized preview-first State C translation plans with coverage-bound digests, explicit canonical writes/replacements, fingerprinted foreign-file removals, and file-to-directory collision ordering.
- Added deterministic five-platform adapter manifests and delegations to State C plans, including preimage-backed convention-file replacement, replacement-before-removal ordering, and fail-closed handling for unimplemented adapter surfaces.
- Added approved State C transactional apply with exact expected-inventory checks, live canonical and adapter validation, clean genesis, source-drift refusal, reverse rollback at every operation boundary, and recovery cleanup after success.
- Added evidence-backed `relocated` coverage for byte-preserving moves to safe project-owned destinations and rollback-safe deepest-first cleanup of translated directories proven empty.
- Extended the deterministic five-adapter installation and live-validation contract to State A and State B adoption, reserved generated adapter paths from scaffold ownership, and made canonical validation detect installed adapter drift.
- Added preview-first managed adapter repair with inventory-stable plan digests, preimage-bound replacements, missing-parent creation, collision refusal, live validation, and exact fault-injection rollback.
- Added ownership-aware managed upgrades that merge project-specific manifest fields, replace only release protocol/generated targets, reject downgrades, and prove byte preservation across project, runtime, continuity, and untargeted files.
- Installed the exact checked self-contained engine and adjacent SHA-256 in every adoption and upgrade, with canonical checksum validation and source/skill/template/installed distribution parity checks.
- Added event-free `pcp register` with stable human and agent profiles, ignored project-local identity caches, separate execution ULIDs, serialized concurrent recovery, and fail-closed stale or ambiguous identity handling.
- Added two-phase `pcp status` with transitive dependency, shared-state, registry, semantic-scope, and overlapping-path relevance; read-only previews produce stable digests, while matching acknowledgements atomically advance one local checkpoint without creating an event.
- Kept archived event contents out of normal registration and reconciliation while retaining filename-based active-floor detection and explicit full archive validation.
- Added `pcp record` with external schema-valid input, performer/recorder attribution, stable-key suppression for duplicate reported/observed changes, tamper-evident payload digests, globally ordered ULIDs, automatic 64/32 active-history rotation, and exact rollback across every caught failure boundary.
- Added digest-bound `pcp workstream validate/create/update/complete` operations with lifecycle guards, dependency-safe criterion evidence, completion announcements, concurrent stale-plan refusal, automatic workstream events, and one transaction over the registry, generated view, active history, and archive rotation.
- Added evidence-backed parity coverage and a sanitized source-only FlowForge State B reference adoption.
- Documented architecture, lifecycle, compatibility, safety, contribution, troubleshooting, and private vulnerability-reporting boundaries without overstating adapter, checksum, or secret-scan guarantees.
- Exposed exact retained recovery locations through ephemeral structured diagnostics without persisting machine paths in canonical state.
- Added allowlisted package-content auditing, generated-package private-data scanning, and explicit Ubuntu/Windows packaged lifecycle golden jobs required by aggregate CI.
- Added a reproducible release-candidate source manifest, public acceptance audit, and explicit unfreeze/re-verification rule before private dogfood may continue.
