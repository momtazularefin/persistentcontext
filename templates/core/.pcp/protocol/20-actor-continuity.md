---
doc: protocol/20-actor-continuity.md
type: protocol
status: static
version: 2.0.0
last_updated: 2026-08-13T21:20:38+06:00
ownership: protocol
---

# Actor continuity and synchronization

## Identity

- One durable actor ID identifies an agent client on one machine for the life of the project.
- Create the ID once as `<actor-label>-<machine-label>-<10-character-Crockford-suffix>`. Use lowercase kebab-case for the two readable components and an uppercase Crockford suffix generated without a shared counter.
- Use the app name as the actor label: `antigravity`, `codex`, `claude`, `copilot`, or `cursor`. Use `human` for a human actor. An app PCP does not yet define must choose one lowercase word as its app label instead of using a generic `other` label.
- Derive the machine label from the value returned by the machine's `hostname` command. Registration obtains it automatically and normalizes that value to lowercase kebab-case; callers do not invent or override a machine alias.
- Human contributors may also have stable actor profiles for reported or observed attribution; humans do not use synchronization checkpoints.
- One execution ULID identifies one conversation. Simultaneous conversations for the same actor must use different execution IDs.
- Run `register` once when a conversation lacks either identity. Registration recovers or creates the actor and returns a fresh execution ID; it creates no continuity event.
- Never rename or recalculate an installed durable identity. Profiles created by an older PCP release with legacy app or machine labels remain immutable and recoverable.
- A matching local cache remains authoritative when its stored machine label differs from the current hostname. If that cache is missing, recovering a profile with a different legacy machine label requires its explicit actor ID; do not guess among machines.
- Keep actor profiles free of credentials, private platform identifiers, and transcripts.

## Mandatory synchronization

- At the start of every user request, before answering or using project tools, run `node .pcp/tools/pcp.mjs sync . --actor-id <actor-id> --execution-id <execution-id>`.
- A current checkpoint returns a concise no-change result. Continue without rereading PCP state.
- A stale checkpoint returns every newer active event in globally ordered ULID order, with attribution, summary, and affected current paths.
- If a baseline is required, begin at `.pcp/00-index.md`. If changes are returned, read every named current path. Current documents remain authoritative; event prose is not replayed as state.
- Advance only the matching recomputed digest by adding `--acknowledge <sync-digest>` after absorbing the result. Preview is read-only; acknowledgement writes only the ignored per-execution checkpoint and creates no event.
- If a checkpoint predates the active window, rebuild from current canonical context instead of routinely reading the archive.
- Work labels, semantic scopes, paths, and dependency guesses never decide whether a newer event is delivered.
- If the project-local engine is unavailable or reports invalid context, stop project work and report the failure instead of bypassing synchronization.

## Recording meaningful change

- After current canonical state is valid, record one minimal immutable event for a meaningful durable change.
- Record performer, recorder, and basis (`self`, `reported`, `observed`, or `system`). Reported or observed changes require a stable external `change_key`.
- Include at least one scope, optional work label, or affected path. Work labels are descriptive only.
- Do not record inspection, registration, synchronization, acknowledgement, no-op rendering, or adoption.
- Never edit an existing event; append a corrective event.

## Bounded history

- Keep at most 64 active events. Before event 65 is accepted, rotate the oldest 32 immutable records to archive in the same transaction.
- Normal synchronization inspects archive filenames only when it must detect that a checkpoint fell behind the active floor. Archive contents require an explicit audit, recovery, or historical request.
