---
doc: state/00-index.md
type: index
status: living
version: 2.0.0
last_updated: 2026-08-13T21:20:38+06:00
ownership: protocol
---

# Canonical state

Read these machine-readable records as the current authority:

1. `project.yaml` — stable project identity, purpose, lifecycle, and boundaries.
2. `projects.yaml` — managed subprojects and repositories.
3. `workstreams.yaml` — optional descriptive work labels, status, and completion evidence. Labels never filter synchronization.
4. `vcs-policy.yaml` — explicit version-control responsibility boundary.

Generated Markdown views never override these YAML records. The `pending-project` baseline must be replaced with grounded project facts before adoption is applied.
