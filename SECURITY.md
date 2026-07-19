# Security policy

## Supported versions

PCP is in active `0.1.0` development and has not declared a stable compatibility window. Security fixes currently target the latest `main` source and the current `0.1.x` release line when published. Older development snapshots are not maintained separately.

## Report privately

Do not open a public issue containing an exploit, secret, private repository content, destructive fixture, or detailed reproduction that could put users at risk.

Use GitHub's private vulnerability-reporting form from this repository's **Security** tab when it is available. Include:

- the affected PCP version or commit;
- the operating system and Node.js version;
- the command or lifecycle phase involved;
- the expected and observed safety boundary;
- the smallest redacted reproduction;
- whether secrets, arbitrary file access, unintended deletion, rollback failure, identity confusion, or supply-chain artifacts are involved; and
- any known workaround that does not weaken another control.

If private vulnerability reporting is unavailable, open a minimal public issue asking the maintainer to establish a private channel. Include no vulnerability details in that issue.

Never send real credentials or private project data. Replace them with structurally equivalent synthetic values and state what was redacted.

## Response expectations

This is a maintainer-led pre-`1.0.0` project, so no contractual response-time SLA is offered. A valid report will be assessed for affected boundaries, reproduction, severity, and whether the issue belongs to PCP or an external agent, editor, VCS, operating system, or hosting service.

Confirmed issues should be fixed in public source with regression coverage while withholding exploit-enabling detail until users have a reasonable opportunity to update. Release and disclosure timing depends on impact and available mitigations.

## Security scope

High-priority PCP issues include:

- mutation outside the reviewed project or approved plan;
- following a symlink or crossing a nested-repository boundary unexpectedly;
- relocation or removal of uncovered State C source, or cleanup of a directory not proven empty;
- incomplete or misleading rollback acceptance;
- bypass of plan, preimage, source-drift, ownership, or lock validation;
- exposure of secrets or private fixture data in source, packages, output, or logs;
- package/checksum divergence that passes verification;
- unauthorized VCS action despite canonical policy; and
- event, actor, checkpoint, or workstream corruption that passes canonical validation.

PCP does not claim to sandbox agents, authenticate event authors, prevent an authorized local process from editing files directly, scan arbitrary code for malware, or replace dedicated secret scanning, backups, signed VCS, branch protection, and operating-system access control. See the full [safety and security model](docs/safety.md).
