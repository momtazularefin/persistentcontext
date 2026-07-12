---
doc: references/10-git-github-bare-minimum.md
type: reference
status: living
version: 1.0.0
last_updated: 2026-07-12T13:10:00Z
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

Commit signing is optional unless repository or organization policy requires it. Configure a real SSH or GPG signing key before enabling signing; never bypass a requirement by weakening repository policy.

## Start a milestone branch

```text
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
git switch -c feat/milestone-name
```

Stop if the worktree contains changes you do not own. Do not erase them to obtain a clean status.

## Commit a verified unit locally

```text
git diff --check
git status --short
git add -- <intentional-paths>
git diff --cached --check
git diff --cached
git commit -m "feat: describe the coherent unit"
```

Use `fix:`, `docs:`, `test:`, `refactor:`, `build:`, or `chore:` when they describe the change better. Do not push each routine unit in the recommended flow.

## Publish one milestone PR

```text
git push -u origin feat/milestone-name
gh pr create --title "feat: describe the milestone" --body-file <prepared-body-file>
gh pr checks --watch
```

The agent reports the PR and evidence. A human reviews and merges it. The agent does not self-merge.

## Continue after human merge

```text
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Verify the merged commit and required checks before deleting the matched local branch. A squash merge may require `git branch -D <branch>` only after its exact PR head and merged result have been proven. Then run the proportionate merged-tree check and create the next milestone branch.

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
