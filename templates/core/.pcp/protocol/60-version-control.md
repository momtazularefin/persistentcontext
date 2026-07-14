---
doc: protocol/60-version-control.md
type: protocol
status: static
version: 1.0.0
last_updated: 2026-07-14T07:20:00Z
ownership: protocol
---

# Version control

`state/vcs-policy.yaml` is the sole authority for Git and hosting responsibilities. Repository presence and tool capability never imply permission.

## Profiles

- `none`: every VCS action is prohibited.
- `human-owned`: agents may inspect Git read-only; the human performs declared VCS actions.
- `human-commit`: agents prepare and verify coherent units; the human reviews, stages, and signs each commit; other responsibilities remain explicit.
- `agent-managed`: agents perform routine branch, commit, push, PR, CI, and post-merge work; the human reviews and merges.
- `custom`: every responsibility is assigned explicitly.
- Before a policy is selected, behave as `none`.

PCP recommends the `human-commit` profile as a transparent starting point. It does not require Git, GitHub, pull requests, or that profile. A project may choose another profile, define a custom policy, or replace this VCS policy with project-owned guidance for another system such as Subversion.

## Recommended human-commit flow

1. Synchronize the protected default branch and create one milestone branch.
2. After each coherent verified unit, show the human the changed paths, checks, diff, and exact signed-commit commands, then wait.
3. Accept the human's commit report as the workflow boundary. Record the human VCS action without asserting independent verification.
4. Do not push routine units. At a substantial milestone, push and open a PR only if the selected policy assigns those actions and the PR policy is accepted by the project.
5. Ask the human to review and merge when a PR is used.
6. After the human reports completion, perform the assigned post-merge continuation and create the next branch.

Agents do not self-merge, force-push, rewrite published history, weaken protection, expose credentials, stage unrelated changes, or perform destructive recovery unless a custom policy explicitly assigns that exact action.

See [../references/10-git-github-bare-minimum.md](../references/10-git-github-bare-minimum.md) for the concise operational command guide.
