---
doc: references/10-git-github-bare-minimum.md
type: reference
status: living
version: 1.0.0
last_updated: 2026-07-14T07:20:00Z
ownership: project
---

# Git and GitHub bare minimum

Use this guide only after `../state/vcs-policy.yaml` assigns the relevant action to you. The policy outranks this reference.

## One-time identity and authentication

```text
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
gh auth login
gh auth status
```

The recommended `human-commit` profile uses signed commits. Configure a real SSH or GPG signing key before selecting required signing; never bypass a requirement by weakening repository policy.

## Start a milestone branch

```text
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
git switch -c feat/milestone-name
```

Stop if the worktree contains changes you do not own. Do not erase them to obtain a clean status.

## Hand a verified unit to the human

The agent runs the non-mutating checks, reports their results, names the intentional paths, and supplies the following commands. The human reviews the diff, stages the unit, and signs the commit.

```text
git diff --check
git status --short
git add -- <intentional-paths>
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -S -m "feat: describe the coherent unit"
git log -1 --show-signature --format=fuller
```

Use `fix:`, `docs:`, `test:`, `refactor:`, `build:`, or `chore:` when they describe the change better. The agent waits for the human's completion report and does not require a redundant re-audit before continuing. If later repository evidence conflicts with the report, notify the human and repair through the normal workflow. Do not push each routine unit in the recommended flow.

## Publish one milestone PR

```text
git push -u origin feat/milestone-name
gh pr create --title "feat: describe the milestone" --body-file <prepared-body-file>
gh pr checks --watch
```

Use a PR only when the selected policy recommends or requires one and assigns these actions to the current actor. The agent reports the PR and evidence. A human reviews and merges it. The agent does not self-merge.

## Continue after human merge

```text
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

In the recommended human-commit profile, accept the human's report that the commit, review, merge, or branch deletion completed and proceed with assigned synchronization. If repository state later disagrees, report the mismatch and fix it safely. A squash merge may require `git branch -D <branch>` only after the branch is matched to the reported PR. Then run the proportionate merged-tree check and create the next milestone branch.

## Safe diagnosis

```text
git status --short --branch
git branch -vv
git log --oneline --decorate -12
git diff
git diff --cached
git remote -v
gh auth status
gh pr status
```

Never use force-push, history rewriting, blind recursive cleanup, protection changes, credential output, or destructive recovery unless the explicit VCS policy assigns that exact action and the repository permits it.
