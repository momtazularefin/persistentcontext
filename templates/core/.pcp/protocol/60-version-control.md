---
doc: protocol/60-version-control.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
ownership: protocol
---

# Version control

`state/vcs-policy.yaml` is the sole authority for Git and hosting responsibilities. Repository presence and tool capability never imply permission.

## Profiles

- `none`: every VCS action is prohibited.
- `human-owned`: agents may inspect Git read-only; the human performs declared VCS actions.
- `agent-managed`: agents perform routine branch, commit, push, PR, CI, and post-merge work; the human reviews and merges.
- `custom`: every responsibility is assigned explicitly.
- Before a policy is selected, behave as `none`.

## Recommended agent-managed flow

1. Synchronize the protected default branch and create one milestone branch.
2. Commit each coherent verified unit locally with Conventional Commits; do not push routine units.
3. After a substantial milestone passes the full gate, push once and open a ready-for-review PR.
4. Ask the human to review and merge the PR.
5. Verify PR and CI evidence, fetch and prune, switch to the default branch, fast-forward only, verify a clean merged tree, remove the proven local milestone branch, and create the next branch.

Agents do not self-merge, force-push, rewrite published history, weaken protection, expose credentials, stage unrelated changes, or perform destructive recovery unless a custom policy explicitly assigns that exact action.

See [../references/10-git-github-bare-minimum.md](../references/10-git-github-bare-minimum.md) for the concise operational command guide.
