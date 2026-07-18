# Compatibility

This matrix describes the implemented PCP `0.1.0` contract. It distinguishes verified repository behavior from interactive product testing and avoids treating a file convention as support for an entire editor or agent feature set.

## Runtime and operating systems

| Surface            | Supported contract                       | Verification                                                                        |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Node.js            | `>=24 <25`                               | Declared by `package.json`; build and all engine commands run on Node 24.           |
| npm                | `11.16.0` lockstep development toolchain | Declared by `packageManager`; clean CI uses `npm ci`.                               |
| Windows            | `windows-latest`                         | Quality, package/private scans, and packaged lifecycle golden matrix jobs.          |
| Linux              | `ubuntu-latest`                          | Quality, package/private scans, and packaged lifecycle golden matrix jobs.          |
| Text normalization | LF in the repository                     | Enforced by `.gitattributes`; runtime path handling normalizes platform separators. |

macOS is not part of the `0.1.0` CI matrix. PCP uses portable Node APIs and repository-relative paths, but absence of a macOS verification job means macOS should be treated as unverified rather than promised.

The repository is private to npm and exposes no global `bin`. Development uses `tsx`; built and installed projects execute the self-contained `pcp.mjs` bundle with Node.

## Agent-product adapters

Every adoption state installs the same five generated adapters. Each contains only a thin delegation to `.pcp/00-index.md` and is validated against its manifest, canonical source, target, and SHA-256 content digest.

| Adapter ID              | Product surface                                          | Generated target                  | Contract                                                                      |
| ----------------------- | -------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `codex`                 | Codex project instructions                               | `AGENTS.md`                       | Routes project work to canonical PCP context.                                 |
| `antigravity`           | Antigravity project rule                                 | `.agents/rules/pcp.md`            | Routes project work to canonical PCP context.                                 |
| `claude-code-desktop`   | Claude Code Desktop project memory                       | `CLAUDE.md`                       | Uses the product's project-file reference form to read the canonical entry.   |
| `github-copilot-vscode` | GitHub Copilot in Visual Studio Code custom instructions | `.github/copilot-instructions.md` | Routes workspace instructions to canonical PCP context.                       |
| `cursor`                | Cursor project rule                                      | `.cursor/rules/pcp.mdc`           | Installs an always-applied project rule that routes to canonical PCP context. |

This is an adapter-contract claim. PCP tests deterministic generation, validation, collision handling, repair, and equivalent canonical reconstruction. It does not claim exhaustive interactive testing across every product UI, extension version, model, setting, or operating mode.

An existing supported adapter target is never silently overwritten: adoption previews a preimage-bound replacement. State C removes a legacy supported surface only after its canonical delegation is ready. A detected adapter or capability outside this five-product contract blocks destructive translation rather than being guessed or deleted.

## Repository shapes

PCP does not require a conventional source or documentation layout. Intake and adoption cover:

- State A prose, README, specification, title-only, and empty seeds;
- State B software, documentation, research/data, monorepo, deployed, and nested-repository fixtures;
- State C root convention files, tool-specific rule directories, renamed context folders, overlapping foreign layers, structured histories, and projects without history; and
- existing managed installations routed to lifecycle commands.

Inventory honors ignore rules, fingerprints large and binary files without semantic parsing, records symlinks without following them, and stops at nested repository boundaries. A target that crosses a symlink or nested repository boundary is rejected.

PCP preserves ordinary project-owned assets in State B. State A alone may create explicitly approved initial scaffold files. State C requires an evidence-backed disposition for every detected foreign root, preserves roots reviewed as project-owned, and may remove translated foreign context only after complete file/entry coverage and live staged validation.

## Persistence and optional capabilities

Adoption requires an explicit persistence value:

- `tracked` stores the canonical layer as repository state and expects the final candidate to classify as managed.
- `local` keeps the canonical layer usable without requiring version-control tracking.

Core-only adoption selects an empty capability list. Four checked optional overlays are implemented:

- `concurrent-execution-blocks`;
- `scratch-space`;
- `spec-driven-projects`; and
- `walkthroughs`.

Capabilities are installed transactionally in release order and recorded in the manifest. Manual capability-file copying is not a supported lifecycle operation.

## Version-control systems

PCP does not require Git or GitHub. The canonical policy supports:

| Profile         | Meaning                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `none`          | Every VCS action is prohibited.                                                        |
| `human-owned`   | Agents inspect read-only; humans perform declared actions.                             |
| `human-commit`  | Agents prepare verified units; humans review, stage, and sign commits.                 |
| `agent-managed` | Agents may perform routine branch, commit, push, PR, CI, and post-merge work.          |
| `custom`        | Every responsibility is assigned explicitly, including another VCS such as Subversion. |

Before a policy is selected, PCP behaves as `none`. Pull requests are recommended in the reference human-commit flow but are not required by the protocol.

## Release compatibility

`0.1.0` installations contain their exact checked engine and checksum. The release build synchronizes byte-identical engine copies into distribution, skill, and installation assets; distribution verification executes the bundled and installed copies independently.

Upgrade accepts a managed installation only when its canonical layer is valid, its version does not exceed the running release, and the desired release projection can be applied without an unsafe ownership collision. Downgrades are rejected. Project-owned state, continuity, selected capabilities, policy selection, and untargeted files are preserved.

PCP is still pre-`1.0.0`. Schema and protocol compatibility promises are limited to the implemented upgrade path and current release assets; a broader long-term compatibility policy will require an explicit stable release decision.

## Known boundaries

- No global npm CLI or hosted coordination service.
- No macOS CI claim in `0.1.0`.
- No interactive certification of every supported product release.
- No replacement for unsupported product-specific rules, skills, commands, agents, or plugins.
- No automatic reorganization of ordinary project source.
- No semantic interpretation of encrypted, binary, invalid UTF-8, unreadable, or oversized foreign context; those conditions block State C removal.
- No automatic change of selected capabilities through repair or upgrade.
