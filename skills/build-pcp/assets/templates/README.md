# PCP template sources

`core/.pcp/` is the canonical installed-layer baseline. It contains no agent profiles and no journal events.

`capabilities/` contains opt-in overlays. Each capability declares its manifest value, dependencies, root paths, and index entries in `capability.yaml`; applying an overlay must also update the affected `00-index.md` files.

Template sources use project-neutral baseline values. Adoption replaces the pending project state with grounded facts before anything is written to a target repository.
