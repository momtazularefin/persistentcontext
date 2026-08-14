# Compatibility

This matrix describes the implemented PCP `0.2.0` contract. It separates verified repository behavior from product-runtime behavior and does not treat an instruction-file convention as certification of an entire editor, model, or mode.

## Runtime and operating systems

| Surface            | Supported contract                       | Verification                                                               |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------------------- |
| Node.js            | `>=24 <25`                               | Declared by `package.json`; build and engine commands run on Node 24.      |
| npm                | `11.16.0` lockstep development toolchain | Declared by `packageManager`; clean CI uses `npm ci`.                      |
| Windows            | `windows-latest`                         | Quality, package/private scans, and packaged lifecycle golden matrix jobs. |
| Linux              | `ubuntu-latest`                          | Quality, package/private scans, and packaged lifecycle golden matrix jobs. |
| Text normalization | LF in the repository                     | Enforced by `.gitattributes`; runtime paths normalize platform separators. |

macOS is not in the current CI matrix. PCP uses portable Node APIs and repository-relative paths, but macOS should be treated as unverified rather than promised.

The repository is private to npm and exposes no global `bin`. Development uses `tsx`; adopted projects run their exact self-contained `.pcp/tools/pcp.mjs` bundle with Node.

## Agent-product adapters

Every adoption state installs the same five generated adapters. Each embeds the mandatory register-and-sync contract, delegates durable context to `.pcp/00-index.md`, and is validated against its manifest, source, target, and SHA-256 content digest.

| Adapter ID              | Registration app | Product surface                    | Generated target                  | Discovery contract                                                                                                   |
| ----------------------- | ---------------- | ---------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `codex`                 | `codex`          | Codex project instructions         | `AGENTS.md`                       | Codex discovers repository `AGENTS.md` guidance before project work.                                                 |
| `antigravity`           | `antigravity`    | Antigravity workspace rule         | `.agents/rules/pcp.md`            | Uses the documented workspace-rules directory; workspace rule activation still depends on product behavior/settings. |
| `claude-code-desktop`   | `claude`         | Claude Code project memory         | `CLAUDE.md`                       | Claude loads project memory at conversation start; the adapter explicitly references `@.pcp/00-index.md`.            |
| `github-copilot-vscode` | `copilot`        | GitHub Copilot custom instructions | `.github/copilot-instructions.md` | Workspace instructions are added automatically when the setting is enabled; users can disable custom instructions.   |
| `cursor`                | `cursor`         | Cursor project rule                | `.cursor/rules/pcp.mdc`           | Generated frontmatter sets `alwaysApply: true`.                                                                      |

Adapter IDs name integration surfaces; registration app names form actor-ID prefixes. The machine component is derived from the local system hostname, not configured per adapter.

The conventions are grounded in the products' documentation: [Codex `AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Antigravity rules](https://antigravity.google/docs/rules-workflows), [Claude Code memory](https://code.claude.com/docs/en/memory), [GitHub Copilot repository custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot), and [Cursor rules](https://docs.cursor.com/context/rules).

PCP tests deterministic generation, collision handling, repair, validation, and equivalent canonical reconstruction across all declared startup surfaces. That is an adapter-contract claim. PCP cannot force a model to obey text, prevent a user from disabling project instructions, or prove that every UI mode loads them. A product with hooks may add a fail-closed pre-tool guard, but the hook must delegate to PCP rather than become another project-context authority.

An existing supported adapter is never silently overwritten: adoption previews a preimage-bound replacement. State C removes a legacy supported surface only after its canonical replacement is staged. An unsupported adapter surface blocks destructive translation rather than being guessed or deleted.

## Synchronization contract

The five adapters require one fresh execution ID per conversation and global `sync` before every response or project-tool use. No-change output is immediate plain text. Changed output includes all newer active events and the current canonical paths to absorb; acknowledgement is digest-bound and advances only that execution's ignored checkpoint.

PCP does not promise nanosecond subprocess startup. The fast path avoids full canonical validation and event-body reads when no event is newer; actual latency includes Node process startup and local filesystem cost. A persistent host integration could reduce that overhead later without changing protocol semantics.

Run `npm run benchmark:sync` to measure the current machine. A Windows reference run on 2026-08-14 measured 100 in-process no-change samples at 14.809 ms median (11.328–19.846 ms) and 20 fresh-process CLI samples at 220.689 ms median (202.650–254.163 ms). These figures are local evidence, not a universal latency guarantee; the cold result is dominated by starting Node for each call.

## Repository shapes

PCP does not require a conventional source layout. Intake covers clean prose or empty seeds, established software/documentation/data repositories, monorepos and nested repositories, foreign context layers, and already managed installations. It reuses a dedicated existing documentation directory when found and otherwise establishes `docs/`; outcome knowledge stays there while `.pcp/state/documentation.yaml` tracks all ordinary project documents wherever they live.

Inventory honors ignore rules, fingerprints large and binary files without semantic parsing, records symlinks without following them, and stops at nested-repository boundaries. Adoption preserves ordinary assets and requires reviewed complete coverage before translating or removing foreign context.

## Persistence and optional capabilities

Adoption requires `tracked` or `local` persistence. Core-only adoption selects an empty capability list. Three checked optional overlays are implemented:

- `scratch-space`;
- `spec-driven-projects`; and
- `walkthroughs`.

The CEB overlay was removed in 0.2. Flat sequential/concurrent work labels remain in core, but dependency tracking, impact inference, and dependency-sensitive synchronization are outside PCP's scope.

## Version-control systems

PCP does not require Git or GitHub. The canonical policy supports `none`, `human-owned`, `human-commit`, `agent-managed`, and complete `custom` responsibility maps. Before policy selection PCP behaves as `none`. Pull requests are recommended in the reference human-commit flow but are not required by the protocol.

## Release compatibility

`0.2.0` installations contain their exact checked engine and checksum. Build synchronizes byte-identical copies into distribution, skill, and installation assets; distribution verification executes the bundled and installed copies independently.

The update check snapshots `momtazularefin/persistentcontext` `main`, reads the canonical template manifest at that exact commit, and compares its version with the installed manifest. Upgrade accepts a valid managed installation only when its version does not exceed the incoming verified engine version and the desired projection has no unsafe ownership collision. The explicit 0.1 migration removes obsolete CEB and scoped-checkpoint structures while preserving actors, events, project-owned state, policy, and untargeted files. Downgrades are rejected. Project-derived semantic rewrites remain agent work guided by the upgrade result.

History purge is supported only as a separate post-upgrade human choice. It removes PCP identities and continuity history transactionally, not source, current documentation, project state, or Git history.

PCP remains pre-`1.0.0`. Compatibility promises are limited to implemented upgrade paths and current checked release assets.

## Known boundaries

- No global npm CLI, persistent daemon, or hosted coordination service.
- No current macOS CI claim.
- No interactive certification of every supported product release or setting.
- No hard guarantee that an agent product obeys generated textual instructions.
- No dependency graph, impact monitor, or source-work scheduler.
- No replacement for unsupported product-specific rules, skills, commands, agents, or plugins.
- No automatic reorganization of ordinary project source.
- No semantic interpretation of encrypted, binary, invalid UTF-8, unreadable, or oversized foreign context.
