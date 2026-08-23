# PCP documentation

These documents explain the public protocol from the outside in. The installed files under `templates/core/.pcp/` remain the normative project-level rules; this folder explains the product, lifecycle, and evidence for contributors and adopters.

## Start here

1. [Getting started](getting-started.md) — one-time adoption, automatic five-platform adapters, normal sync behavior, and recovery guidance.
2. [Why PCP exists](motivation.md) — the context-loss problem PCP was built against, and why the layer is separable.
3. [Architecture](architecture.md) — product boundaries, canonical state, ownership, and runtime flow.
4. [Lifecycle](lifecycle.md) — adoption through mandatory synchronization, repair, and upgrade.
5. [Compatibility](compatibility.md) — verified runtimes, platforms, adapters, project shapes, and known boundaries.
6. [Safety and security model](safety.md) — trust assumptions, mutation safeguards, integrity limits, and safe operation.
7. [Security policy](../SECURITY.md) — private vulnerability reporting and security scope.
8. [Troubleshooting](troubleshooting.md) — error-code-led diagnosis and safe recovery boundaries.
9. [Contributing](../CONTRIBUTING.md) — source ownership, test expectations, fixtures, and review checklist.
10. [Capability lineage and parity](capability-parity.md) — behaviors preserved or deliberately superseded from earlier orchestration experience.
11. [0.1.0 release candidate](release-candidate.md) — public acceptance audit, reproducible identity, verification contract, and freeze rule.
12. [0.1.0 release notes](release-notes.md) — shipped capabilities, dogfood evidence, boundaries, and publication instructions.

The root [README](../README.md) remains the concise command reference and current implementation statement. When explanatory documentation and installed protocol text disagree, treat the installed release assets and executable validation as authoritative, then correct the stale explanation.
