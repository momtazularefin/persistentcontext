---
doc: protocol/10-context-contract.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Context contract

## Authority

- `pcp.yaml` defines protocol version, capabilities, ownership, adapters, and validation policy.
- `state/*.yaml` is canonical structured state.
- Numbered project-owned Markdown carries grounded knowledge, policy, plans, and rationale.
- Generated views and platform adapters are read-only projections.
- The repository outranks private agent memory when they conflict.

## Ownership

- Protocol-owned files may change only through a reviewed PCP upgrade.
- Project-owned files survive protocol upgrades and remain the adopted project's truth.
- Generated files may be replaced only from their declared canonical sources.
- Runtime files are local, disposable, and never durable context.
- Unknown files are preserved until an explicit preview resolves their ownership.

## Clean genesis

- Adoption builds a complete current-state baseline, not a synthetic project history.
- The initial `agents/` folder has no profile records.
- The initial `journal/events/` folder has no event records.
- Foreign histories and identities are never copied into the clean PCP baseline.
- The first meaningful post-adoption durable change becomes the first journal event.
