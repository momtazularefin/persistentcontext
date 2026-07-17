# FlowForge State B reference

This example is a sanitized source-only project used to prove PCP adoption of an established software repository that has no persistent agent layer.

- [`before/`](before/) contains the ordinary project files presented to PCP. It deliberately excludes prior context layers, histories, identities, generated binaries, package caches, and machine-specific paths.
- [`adoption-input.yaml`](adoption-input.yaml) is the reviewed semantic baseline grounded in those source files.
- [`expected.yaml`](expected.yaml) records stable observable outcomes rather than duplicating generated PCP release files.

The integration contract copies `before/` to a temporary directory, confirms State B classification, previews and applies the reviewed plan, proves every original byte survives, validates clean genesis and all five adapters, and checks that a newly registered agent can obtain current context through scoped status.

FlowForge is intentionally small: it is a dependency-aware .NET task runner with a library, CLI, JSON run storage, an example pipeline, and a self-contained test runner. It is a reference fixture, not a second PCP implementation.
