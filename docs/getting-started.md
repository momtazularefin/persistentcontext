# Getting started

Persistent Context Protocol (PCP) is designed to become part of a project, not a prompt that users must paste into every chat. Adoption generates the project instruction surface for each supported agent product. On later requests, that adapter requires the agent to synchronize before it answers or uses project tools.

The generated adapter and `.pcp/00-index.md` are the operating contract. This guide is an introduction and recovery reference, not a second source of authority.

## Adopt PCP once

Run the following project-neutral request in an agent environment that can load the public `build-pcp` skill:

```text
I want to adopt Persistent Context Protocol (PCP) in this repository.

Use the public build-pcp skill from:
https://github.com/momtazularefin/persistentcontext

Inspect the repository and classify it as State A, State B, State C, or already managed. If it is not managed, progressively gather enough evidence to prepare a complete, grounded PCP adoption preview.

Preserve ordinary project files. Keep agent-operational knowledge in .pcp, keep project-outcome knowledge in the established documentation directory or the default docs/ directory, and catalog every project document from .pcp/state/documentation.yaml. For State C, translate current useful context only after every detected foreign source has a reviewed disposition and complete coverage. Do not import old actor identities, checkpoints, or changelog history.

Show me the classification evidence, indispensable unresolved choices, exact normalized mutation plan, and plan digest. Do not apply the plan until I explicitly approve that exact digest. Use the verified build-pcp engine for structural operations; do not reproduce adoption manually.
```

Adoption is preview-first. It installs the project-local engine at `.pcp/tools/pcp.mjs`, the canonical `.pcp/` layer, and all five generated adapters. It also records the selected external documentation root, creates an initial outcome document when establishing the default `docs/` folder, and catalogs every surviving ordinary project document. Do not assume a global `pcp` command exists.

## Normal use after adoption

No PCP startup prompt should be necessary. Open the repository through a supported product and make the ordinary project request. The generated adapter requires the agent to:

1. register or recover one stable actor and obtain a fresh execution ID for the chat when those IDs are not already in conversation state;
2. run `node .pcp/tools/pcp.mjs sync . --actor-id <actor-id> --execution-id <execution-id>` before every response or project-tool use;
3. continue immediately when the engine reports no project updates;
4. when updates exist, read every returned current path and then acknowledge the exact sync digest; and
5. stop rather than bypass PCP when the local engine or canonical layer is missing or invalid.

Every chat receives a new execution ID. Reopening a product or starting a new chat is not a new durable actor: registration recovers the same actor for the same client and machine identity while returning a new execution ID. Separate chats owned by the same actor therefore keep independent checkpoints and cannot acknowledge updates for one another.

Registration can create an actor profile and ignored local identity cache. Sync preview is read-only; sync acknowledgement writes one ignored per-execution checkpoint. These are PCP operational writes, not continuity events.

## Supported automatic adapters

| Product                              | Generated project instruction     | Registration app |
| ------------------------------------ | --------------------------------- | ---------------- |
| Codex                                | `AGENTS.md`                       | `codex`          |
| Antigravity                          | `.agents/rules/pcp.md`            | `antigravity`    |
| Claude Code Desktop                  | `CLAUDE.md`                       | `claude`         |
| GitHub Copilot in Visual Studio Code | `.github/copilot-instructions.md` | `copilot`        |
| Cursor IDE                           | `.cursor/rules/pcp.mdc`           | `cursor`         |

Codex and products that also inspect root `AGENTS.md` may share that entry point. Cursor's generated rule is always applied. Claude's adapter includes an explicit canonical-file reference. Every generated surface contains the same mandatory synchronization contract and delegates durable authority to `.pcp/00-index.md`.

Registration automatically derives the machine portion of the durable actor ID from the system `hostname` value and normalizes it to lowercase kebab-case. A PCP-unknown app may register with one lowercase word as its app name. Humans use `human`. Existing IDs are recovered exactly and are never renamed to match a newer label convention.

Product instruction files are the strongest portable discovery mechanism common to the five products; they are not an operating-system interceptor. A product setting, mode, or user action may disable or ignore project instructions. PCP deterministically generates, validates, repairs, and tests the adapters, but cannot truthfully guarantee model compliance outside product capabilities. Where a platform offers policy hooks, a project may add stronger enforcement without creating a competing source of project context.

## Recovery prompt

Use this only when a supported product did not appear to load its adapter automatically:

```text
This is a PCP-managed repository. Before project work, read the platform adapter for this product and `.pcp/00-index.md`. Register once for this chat if actor or execution identity is missing. Then run the mandatory global `sync` command and follow its returned paths and acknowledgement digest. Do not invent a scoped status request, dependency filter, or second context authority. If the adapter or project-local engine is missing or invalid, stop and report that condition.
```

The recovery prompt diagnoses discovery failure; it is not the expected day-to-day workflow. A missing or changed generated adapter should be repaired through digest-bound `pcp repair`, not maintained manually.

## Meaningful changes

Synchronization consumes continuity; it does not create it. After accepting a meaningful durable project change, update the relevant internal PCP sources and every affected external project document, maintain `.pcp/state/documentation.yaml` when document paths or purposes change, and record one minimal attributed event. Do not record routine reads, registration, synchronization, acknowledgements, no-op validation, or discussion that changed no durable project fact.

Workstreams remain optional descriptive work labels with lifecycle, affected paths or areas, completion criteria, and evidence. They are not dependency graphs, schedulers, or synchronization filters. PCP delivers every newer event to every conversation regardless of workstream, scope, or path labels.
