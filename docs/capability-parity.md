# Capability lineage and parity

PCP grew from two kinds of practical orchestration experience: a portable repository-context template and a mature multi-project command center. This record checks that their useful behaviors survived the transition into a public, project-neutral protocol.

“Preserved” means PCP retains the behavior directly, often in a more general form. “Superseded” means PCP keeps the underlying benefit but deliberately replaces the earlier mechanism. It does not mean that two implementations have identical files or commands.

The machine-readable source of this table is [`capability-parity.yaml`](capability-parity.yaml). Contract tests require every listed claim to point to concrete public evidence.

| ID                                       | Origin                   | Outcome    | PCP treatment                                                                              |
| ---------------------------------------- | ------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| `canonical-entry-and-reading-order`      | Portable reference layer | Preserved  | A compact root index leads into numbered, indexed canonical documents.                     |
| `repository-source-of-truth`             | Portable reference layer | Preserved  | Durable context stays in the repository, not in a conversation.                            |
| `tiered-read-only-exploration`           | Portable reference layer | Preserved  | Exploration begins read-only and deepens only when evidence requires it.                   |
| `grounded-knowledge-baseline`            | Portable reference layer | Preserved  | Numbered knowledge documents retain grounded project understanding.                        |
| `snapshot-plus-changelog-reconstruction` | Portable reference layer | Superseded | Living state is authoritative; events explain change but do not reconstruct current truth. |
| `mandatory-full-startup-reread`          | Portable reference layer | Superseded | Scoped, digest-bound status selects relevant files and events.                             |
| `agent-only-registration`                | Portable reference layer | Superseded | Stable human and agent profiles are separated from fresh execution identities.             |
| `unbounded-append-only-changelog`        | Portable reference layer | Superseded | A bounded active event window rotates older records to explicit-only history.              |
| `documentation-and-discoverability`      | Portable reference layer | Preserved  | Metadata, numbering, indexes, and reachability are validated.                              |
| `naming-portability-and-safety`          | Portable reference layer | Preserved  | Relative paths, portable names, and secret exclusion are protocol rules.                   |
| `noncanonical-scratch-space`             | Portable reference layer | Preserved  | An optional overlay provides explicitly noncanonical temporary space.                      |
| `incremental-walkthroughs`               | Portable reference layer | Preserved  | An optional overlay captures tested questions incrementally.                               |
| `fixed-copy-adoption`                    | Portable reference layer | Superseded | State A/B/C intake replaces fixed copying with previewed transactional adoption.           |
| `multi-project-portfolio`                | Advanced command center  | Preserved  | Structured registries and readable project records support broader portfolios.             |
| `spec-driven-delivery`                   | Advanced command center  | Preserved  | An optional overlay adds specification through evaluation records.                         |
| `concurrent-execution-blocks`            | Advanced command center  | Preserved  | CEBs specialize generic workstreams for safe parallel execution.                           |
| `dependency-and-completion-evidence`     | Advanced command center  | Preserved  | Workstreams declare dependencies and require criterion-bound proof.                        |
| `human-and-agent-attribution`            | Advanced command center  | Preserved  | Events distinguish actors from reporters and observers.                                    |
| `scoped-reconciliation`                  | Advanced command center  | Preserved  | Checkpoints bind reconciliation to workstreams, dependencies, scopes, and paths.           |
| `configurable-vcs-ownership`             | Advanced command center  | Preserved  | Explicit profiles cover human, agent, absent, and custom VCS authority.                    |
| `three-state-intake-and-translation`     | Advanced command center  | Preserved  | State C translation complements clean-seed and established-project intake.                 |
| `clean-genesis`                          | Advanced command center  | Preserved  | Adoption imports grounded context without importing actors or history.                     |
| `canonical-platform-adapters`            | Advanced command center  | Preserved  | Five generated adapters delegate to one canonical project context.                         |
| `ownership-aware-repair-and-upgrade`     | Advanced command center  | Preserved  | Lifecycle changes are restricted to approved PCP-owned targets.                            |
| `optional-capability-overlays`           | Advanced command center  | Preserved  | Specialized workflows remain opt-in rather than becoming forced topology.                  |

This is a release-evidence record, not a claim that PCP has reached every future product ambition. New parity claims belong here only after their public implementation or protocol evidence exists.
