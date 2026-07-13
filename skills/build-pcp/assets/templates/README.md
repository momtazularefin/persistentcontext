# PCP template sources

`core/.pcp/` is the canonical installed-layer baseline. It contains no agent profiles and no journal events.

`capabilities/` contains opt-in overlays. Each capability declares its manifest value, dependencies, root paths, and index entries in `capability.yaml`; applying an overlay must also update the affected `00-index.md` files.

Template sources use project-neutral baseline values. Adoption replaces the pending project state with grounded facts before anything is written to a target repository.

State A/B semantic inputs are validated by `schemas/v1/adoption-input.schema.json`. The skill creates that transient input outside the target; the engine overlays its grounded project state and eight required project documents on this core before producing an approved mutation plan.
