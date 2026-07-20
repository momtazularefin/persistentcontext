# Persistent Context Protocol 0.1.0

PCP 0.1.0 turns repository context into portable, validated project state that coding agents can share across tools and machines. It is the first public release of the protocol, the `build-pcp` skill, and the project-local `pcp` engine.

## What ships

- Automatic read-only classification for managed projects and adoption States A, B, and C.
- External semantic input plus digest-bound preview/apply; the engine never invents project meaning or treats a model response as mutation authority.
- Transactional adoption with source fingerprints, path and nested-repository boundaries, preimage checks, write-ahead recovery, live validation, and exact rollback.
- Clean genesis with no copied actors or events, followed by stable project-lifetime identity, execution IDs, scoped status, acknowledgement, and bounded attributed history.
- Digest-bound workstream creation, update, validation, dependency enforcement, completion evidence, and generated status views.
- Ownership-aware adapter repair and protocol upgrade that preserve project and runtime state.
- One self-contained installed engine and five canonical delegations: Codex, Antigravity, Claude Code Desktop, GitHub Copilot in VS Code, and Cursor.
- Optional spec-driven project records, concurrent execution blocks, scratch-space guidance, and walkthrough templates.

## State C proof

The release was dogfooded against an established multi-repository workspace with a non-PCP context layer. The public/private boundary was deliberate: no project name, path, career content, credential, actor identity, or source document is included in this repository.

The final review resolved 365 legacy records into current canonical state or historical-only disposition. The approved plan used 166 transactional operations, including adapter replacement, canonical creation, exact external reference rewrites, one byte-preserving relocation, reviewed removals, and deepest-first directory cleanup.

Before live adoption, the same plan ran against an inventory-identical clone and then deliberately failed after its final operation. PCP restored the exact root inventory and every explicitly rewritten nested-file preimage. The live transaction subsequently validated 77 canonical files, retained no recovery material, and began with empty actor and event history. Its installed engine validated independently without access to this source repository or the skill assets.

All five adapters reconstructed the same current project registry, 13-workstream graph, dependency edges, and VCS authority. This proves the repository adapter contract, not exhaustive behavior across every editor UI or product release.

## Important boundaries

- Node.js 24 and npm 11 are the verified runtime and package-manager line.
- Ubuntu and Windows are the protected CI platforms. macOS remains unverified.
- The executable is installed per project; 0.1.0 does not publish a global npm CLI.
- PCP checks SHA-256 integrity and exact preimages. It does not authenticate authorship, replace Git signing, or protect a malicious host.
- State C requires human or agent review of every foreign root and coverage disposition. Unsupported agent surfaces fail closed.
- Platform support means deterministic adapter generation, validation, repair, and equivalent canonical reconstruction—not interactive testing of every client version.

## Verify from source

```powershell
npm ci
npm run verify
```

The exact reproducible identity is recorded in [`release/0.1.0-rc.json`](../release/0.1.0-rc.json). The tag should be created only from the human-reviewed release merge after all protected checks pass.
