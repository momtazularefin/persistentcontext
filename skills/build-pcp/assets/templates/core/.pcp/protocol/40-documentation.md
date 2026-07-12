---
doc: protocol/40-documentation.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Documentation

## Reading order

- Every canonical Markdown file inside `.pcp/` is numbered within its folder.
- Every multi-document folder starts with `00-index.md`.
- Other documents use increments of ten so later insertions do not require broad renames.
- Convention files and machine-readable structural files are exempt from Markdown numbering.

## Metadata

- Each canonical Markdown file starts with schema-valid YAML frontmatter.
- Record its `.pcp/`-relative path, type, status, semantic version, update time, and ownership.
- Generated documents also record canonical sources and their normalized SHA-256 digest.

## Grounding and maintenance

- Keep facts concise, source-grounded, and owned by one canonical document.
- Update living current state directly, then record a meaningful event when appropriate.
- Re-cut a static knowledge snapshot explicitly; do not silently make it appear continuously current.
- Use relative, resolvable links and keep every canonical document reachable from its folder index.
- Do not duplicate full source code, transcripts, secrets, or temporary reasoning in durable documentation.

## Naming

- Use kebab-case for freely named documents, folders, and scripts.
- Respect language, platform, third-party, and established repository conventions where they govern names.
- Do not rename existing project assets only to match PCP style.
