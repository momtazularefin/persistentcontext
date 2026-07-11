# Contributing

Persistent Context Protocol is being developed through small, evidence-backed milestones.

## Local checks

Use Node.js 24 and npm 11.16.0, then run:

```powershell
npm ci
npm run verify
```

Keep changes focused. Add or update direct tests for every protocol invariant, mutation path, and safe refusal that changes. Do not commit generated dependency folders, credentials, local project context, migration preimages, or private fixture data.

## Pull requests

- Explain the problem and the protocol behavior being changed.
- Include the commands and evidence used for verification.
- Keep documentation claims aligned with behavior available in the same change.
- Treat schema, fixture, adapter, and skill changes as compatibility-sensitive.
- Do not weaken preview, fingerprint, coverage, rollback, clean-genesis, or no-secret safeguards to make a test pass.
