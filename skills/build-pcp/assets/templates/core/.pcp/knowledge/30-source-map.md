---
doc: knowledge/30-source-map.md
type: knowledge
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: project
---

# Source map

## Entry points

- Map the smallest set of files or locations needed to orient a new contributor.
- Include root manifests, convention files, primary entry points, and public interfaces.

## Important areas

- Record each significant artifact root and what it owns.
- Prefer exact relative paths and concise responsibility descriptions.

## Generated and external material

- Identify generated output, vendored dependencies, nested repositories, and external stores.
- Do not treat regenerable output as source of truth.
