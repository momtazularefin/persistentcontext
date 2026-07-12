---
doc: protocol/50-portability-and-safety.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Portability and safety

## Portability

- Store repository-relative forward-slash paths, never drive letters, home directories, or `file:///` links.
- Declare external tools by name and compatible version, not by installation path.
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
