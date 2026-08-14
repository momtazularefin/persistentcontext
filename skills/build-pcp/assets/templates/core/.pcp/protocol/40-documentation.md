---
doc: protocol/40-documentation.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Documentation

## Knowledge boundary

- Keep agent-operational knowledge in `.pcp/knowledge/**`: where code and documents live, how components interact, how to build and test, and which implementation invariants must survive.
- Keep knowledge produced as a project objective outside `.pcp`, under the `documentation_root` recorded for its project in `state/project.yaml` or `state/projects.yaml`.
- Reuse the dedicated documentation folder selected during adoption. When none existed, use `<project-root>/docs/`.
- Track every ordinary project document in `state/documentation.yaml`, including documents outside the outcome root such as a root README. Outcome entries must stay under their owning project's configured root.
- When source, behavior, or decisions change, consult document summaries and `related_paths`, update every affected document, and update the registry whenever a document is added, moved, removed, or changes purpose.

## Reading order

- Every canonical Markdown file inside `.pcp/` is numbered within its folder.
- Every multi-document folder starts with `00-index.md`.
- Other documents use increments of ten so later insertions do not require broad renames.
- Convention files and machine-readable structural files are exempt from Markdown numbering.

## Metadata

- Each canonical Markdown file starts with schema-valid YAML frontmatter.
- Record its `.pcp/`-relative path, type, status, semantic version, update time, and ownership.
- Generated documents also record canonical sources and their normalized SHA-256 digest.

## Internal grounding and maintenance

- Keep facts concise, source-grounded, and owned by one canonical document.
- Update living current state directly, then record a meaningful event when appropriate.
- Re-cut a static knowledge snapshot explicitly; do not silently make it appear continuously current.
- Use relative, resolvable links and keep every canonical document reachable from its folder index.
- Do not duplicate full source code, transcripts, secrets, or temporary reasoning in durable documentation.
- Do not copy project-outcome research or specifications into `.pcp` merely to make them visible to agents; catalog and link the external document instead.

## Naming

- Use kebab-case for freely named documents, folders, and scripts.
- Respect language, platform, third-party, and established repository conventions where they govern names.
- Do not rename existing project assets only to match PCP style.
