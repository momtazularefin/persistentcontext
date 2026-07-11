# Security Policy

## Supported version

PCP is pre-release software. Only the latest development revision is supported until `0.1.0` is released.

## Reporting

Do not open a public issue containing credentials, private project context, migration preimages, machine paths, or repository history. Use the private security-reporting channel configured on the public repository once it is available.

## Security boundaries

PCP is designed to fail closed around structural mutation. A valid preview, unchanged source fingerprints, safe path boundaries, and successful validation are required before an apply operation. PCP must never store secrets in canonical context, journal events, generated adapters, fixtures, or diagnostic logs.

The default policy does not authorize Git writes or external-system mutations.
