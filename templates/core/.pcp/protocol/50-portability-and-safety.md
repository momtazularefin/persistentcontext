---
doc: protocol/50-portability-and-safety.md
type: protocol
status: static
version: 1.1.0
last_updated: 2026-11-07T00:00:00Z
ownership: protocol
---

# Portability and safety

## Portability

- Store project-internal references as repository-relative forward-slash paths. Normalize absolute inputs to that form whenever they identify a path inside the project.
- Represent an external absolute reference with a `file://` URI when it cannot be made project-relative. The URI explicitly identifies a machine-local or network location. Windows drive paths, UNC shares, and POSIX paths are supported reference forms.
- Prefer an external tool's name and compatible version for discovery. Record its absolute location as an explicit reference when the workflow requires that location.
- Free text may quote absolute paths. Structured references and Markdown links follow the relative-first rule.
- Canonical document identities, generated source paths, documentation roots, and mutation destinations remain project-relative and within their declared ownership boundary.
- Validation and synchronization do not read or require the availability of external references. A recorded reference grants no access or mutation authority.
- Treat build output, caches, downloads, locks, staging, and rollback material as regenerable runtime state.
- Keep durable context usable in tracked and fully local persistence profiles.

## Privacy

- Never store credentials, tokens, private keys, secret values, raw environment files, or private platform identifiers.
- Record only the non-secret fact that an external dependency or credential is required.
- Redact or convert sensitive foreign records before State C adoption.

## Mutation safety

- Read-only inspection and validation need no mutation approval.
- Adoption, migration, repair, and upgrade produce a complete preview and require the policy-defined confirmation before applying.
- Recheck source fingerprints, destination boundaries, symlinks, nested repositories, collisions, and available recovery space immediately before mutation.
- Never recursively remove an unresolved computed path.
- Restore exact preimages on failed structural mutation and remove temporary recovery material only after live validation succeeds.
