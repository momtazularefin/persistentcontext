---
doc: knowledge/00-index.md
type: index
status: living
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: project
---

# Knowledge reading order

These project-owned documents form the agent-operational baseline. They help agents locate and change project artifacts congruently; they are not the home for research, specifications, or other knowledge produced as a project outcome:

1. [10-overview.md](10-overview.md) — purpose, scope, and current lifecycle.
2. [20-architecture.md](20-architecture.md) — boundaries, components, and data flow.
3. [30-source-map.md](30-source-map.md) — important files and artifact roots.
4. [40-build-and-tooling.md](40-build-and-tooling.md) — supported build, test, run, and environment commands.
5. [50-domain-and-invariants.md](50-domain-and-invariants.md) — implementation vocabulary and rules agents must preserve.

Put project-outcome knowledge under the `documentation_root` in `../state/project.yaml`, then register its path and maintenance cues in `../state/documentation.yaml`. Add internal knowledge documents here only when they improve agent navigation or implementation consistency. Re-cut static knowledge explicitly when evidence materially changes.
