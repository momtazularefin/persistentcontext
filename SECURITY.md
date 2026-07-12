# Security Policy

## Supported version

PCP is pre-release software. Only the latest development revision is supported until `0.1.0` is released.

## Reporting

Do not open a public issue containing credentials, private project context, migration preimages, machine paths, or repository history. Use the private security-reporting channel configured on the public repository once it is available.

## Security boundaries

PCP is designed to fail closed around structural mutation. A valid preview, unchanged source fingerprints, safe path boundaries, and successful validation are required before an apply operation. PCP must never store secrets in canonical context, journal events, generated adapters, fixtures, or diagnostic logs.

PCP does not infer Git authority. Its explicit VCS profiles are `none`, `human-owned`, recommended `agent-managed`, and complete `custom`; before selection the effective policy is read-only. The recommended profile still prohibits agent credential management, force-push, history rewriting, protection weakening, and self-merge.
