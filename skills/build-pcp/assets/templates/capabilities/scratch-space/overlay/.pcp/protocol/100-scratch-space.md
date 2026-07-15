---
doc: protocol/100-scratch-space.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Scratch space

- Reserve root `scratch/` for temporary analysis, experiments, drafts, downloads, and intermediate artifacts.
- Scratch content is noncanonical and exempt from PCP orphan and documentation-format rules.
- Agents may use it without turning every artifact into durable project state.
- Ignore machine-specific and generated scratch files in version control.
- Promote any enduring fact, decision, artifact, or procedure into its canonical owner before relying on it across tasks.
- Do not use scratch space for credentials or as an untracked substitute for required project records.
