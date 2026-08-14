---
doc: protocol/30-exploration.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Exploration

PCP accepts arbitrary repository layouts. It does not require a predefined source or context folder. Intake reuses an established dedicated documentation folder when one exists; otherwise it defines `docs/` as the outcome-documentation root.

## Intake states

- State A: an empty, title-only, prompt, README, or prose seed.
- State B: an established conventional project with substantive assets and no persistent agent layer.
- State C: an established project with a foreign or noncanonical agent/context layer.
- Existing valid PCP installations route to managed lifecycle commands instead of adoption.

## Progressive tiers

1. Inventory manifests, conventions, ignore rules, entry points, top-level structure, nested repositories, symlinks, and deployment signals without mutation.
2. Read interfaces, contracts, public types, data flow, state model, tests, and high-risk boundaries.
3. Read implementation bodies only where they determine behavior, risk, invariants, or unresolved classification.
4. Use external authoritative research only when repository evidence is insufficient and record its source.

During intake, inventory every project document. Keep the agent-facing repository map inside `.pcp`, but place research, specifications, and other project-outcome knowledge under the configured external documentation root. Record every surviving or newly created document in `state/documentation.yaml` with enough summary and related-path information for future agents to know when it should change.

Stop when the current model is grounded enough to produce a complete baseline and an evidence-backed mutation preview. Do not brute-force an entire large repository merely to claim completeness.

## State C coverage

- Inventory foreign instructions, current knowledge, policies, plans, identities, histories, generated views, and adapters.
- Give every source file and history entry a final disposition before removal.
- Promote current value into canonical owners, then start PCP with no imported events or profiles.
