# Safety and security model

PCP handles persistent instructions, project knowledge, filesystem mutations, identities, and attributed history. Its design therefore favors fail-closed boundaries, explicit mutation authority, exact rollback, and narrow public claims.

This document describes implemented safeguards. It is not a claim that PCP is a sandbox, identity provider, malware scanner, or complete data-loss-prevention system.

## Assets PCP protects

- Ordinary project source, documentation, deployment files, nested repositories, and unknown files.
- Project-owned knowledge, policies, plans, decisions, project records, and workstream state.
- Human and agent identity records, immutable active events, archived history, and scoped checkpoints.
- Generated platform adapters and status views derived from canonical sources.
- Release-owned schemas, protocol files, templates, and the installed engine.

## Trust assumptions

PCP assumes the process running the engine has access to the selected project and that the user or selected policy authorizes the requested operation. It cannot protect a repository from an administrator, malicious process, or agent that independently edits or deletes files outside PCP.

Semantic adoption input is reviewed judgment supplied outside the candidate project. The deterministic engine validates its schema, evidence references, ownership, paths, fingerprints, and approved digest; it cannot prove that a plausible human-written interpretation is factually correct.

VCS signing, branch protection, operating-system permissions, backups, credential stores, and repository hosting remain external controls.

## Read and path safety

- Inspection is non-mutating and reports `mutated: false`.
- Inventory honors ignore rules and nested repository boundaries.
- PCP records symlinks and junctions but never follows them during inventory or adoption planning.
- Canonical paths must be repository-relative, use forward slashes, avoid traversal, and avoid Windows-reserved or forbidden names.
- Adoption, event, and workstream inputs must be regular non-symlink files within their size limits.
- Mutation targets that cross a symlink, nested repository, ignored runtime boundary, or candidate root are rejected.
- Unknown files remain preserved until a reviewed plan explicitly resolves ownership.

## Adoption and mutation safety

Structural adoption, repair, and upgrade share the following controls:

1. read-only inventory and explainable classification;
2. schema-valid external semantic input where required;
3. a complete non-mutating operation preview;
4. SHA-256 fingerprints for source bytes, desired content, and replacement preimages;
5. a normalized plan digest covering the complete reviewed operation;
6. exact digest acknowledgement before apply;
7. source and plan recomputation before mutation;
8. project-scoped structural and continuity locks;
9. staging and preimages outside the candidate;
10. a write-ahead operation log and atomic file replacement;
11. live canonical and adapter validation; and
12. reverse exact rollback after any caught failure.

Recovery evidence is retained when rollback or cleanup cannot be proven. Temporary recovery material is removed only after successful live acceptance.

State C requires complete coverage for every selected foreign file and every parsed history or registry entry. Encrypted, binary, invalid UTF-8, unreadable, malformed, unrecognized structured, oversized, excluded, and symbolic-link sources are blocking issues. An unsupported adapter surface also blocks destructive translation. `project-owned` files caught by cautious directory expansion are preserved without a canonical target.

## Concurrency and continuity integrity

Continuity operations use a project-scoped lock. Registration recovers or creates one stable profile and rolls back partially created profile/cache files on failure. Status acknowledgement recomputes the exact scoped digest under the same lock before advancing a checkpoint.

Events are immutable and receive an engine-computed payload digest. Reported and observed changes require a stable external `change_key`; duplicate active-window keys are rejected. Archive rotation and workstream mutations are transactional and restore their exact registry, view, event, and archive preimages after caught failure.

These digests provide integrity and stale-write evidence. They are not digital signatures, authenticated authorship, non-repudiation, or protection against an attacker who can rewrite both content and digests. Use signed VCS commits and protected hosting when authorship matters.

## Sensitive data

PCP canonical state must not contain credentials, tokens, private keys, secret values, raw environment files, or private platform identifiers. Record only that a non-secret dependency or credential is required.

Canonical validation detects several high-risk patterns, including private-key blocks, AWS access-key IDs, GitHub tokens, OpenAI-style keys, and common secret assignments. Adoption rejects the same classes in scaffold content. Canonical validation also rejects machine-specific absolute paths and `file://` URIs.

The public repository runs a separate private-data scan across source, examples, packaged assets, and generated distribution content. That scan protects this project's publication boundary; it is not a general-purpose secret scanner for arbitrary adopted repositories. Pattern matching can have false negatives and false positives. Use a dedicated secret scanner, hosting protections, and credential rotation as independent controls.

Never place real secrets in an adoption input, coverage matrix, event summary, test fixture, recovery report, issue, or pull request. If a secret is exposed, revoke or rotate it first; deleting it from the latest file is not sufficient once it has entered logs or VCS history.

## VCS and external authority

Repository presence and installed tools do not grant authority. Every VCS action must be assigned by the selected `none`, `human-owned`, `human-commit`, `agent-managed`, or custom policy. Credential management cannot be assigned to an agent by an accepted canonical policy.

PCP does not weaken branch protection, bypass signing, self-merge, force-push, rewrite published history, or perform destructive recovery unless a complete custom policy explicitly grants the exact action. The recommended human-commit profile keeps review, staging, signing, credentials, and merge approval with a human.

## Release and supply-chain integrity

The build creates one self-contained engine and synchronizes identical bytes to `dist/pcp.mjs`, the packaged `build-pcp` skill, and the installation template. SHA-256 records bind the engine and every packaged schema/template asset. Distribution verification compares all copies, checks manifests, executes the bundled engine, adopts a temporary project, and executes the installed engine independently.

A checksum proves byte equality to the checked source artifact. It does not prove who authored the bytes or whether the source itself is trustworthy. Obtain PCP from the intended repository, review release provenance, and use signed release mechanisms when they become available.

## Safe operating checklist

Before structural apply:

- review the exact candidate path, classification, evidence, coverage, operations, removals, replacements, and plan digest;
- confirm no unresolved source, unsupported adapter, unexpected symlink, nested-repository crossing, or secret-like content remains;
- stop concurrent context writers;
- keep an external backup or protected VCS state for high-value repositories; and
- apply only the digest you reviewed with the same external input.

After apply:

- require successful live validation and adapter validation;
- inspect retained recovery evidence if the operation reports failure;
- do not delete recovery material manually until the project inventory and canonical layer are understood;
- rotate any credential that may have appeared in source, transient input, logs, or history; and
- record the meaningful accepted change using the selected actor and VCS policy.

## Reporting a vulnerability

Follow the private reporting guidance in [SECURITY.md](../SECURITY.md). Do not publish exploit details, credentials, private project content, or an unredacted destructive fixture in a public issue.
