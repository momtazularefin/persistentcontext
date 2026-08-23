# Why PCP exists

This document records the practical problem PCP was built to solve. The other documents describe what PCP is and how it behaves; this one describes what was going wrong first. It is background and rationale, not normative protocol text.

## Agent memory stops at three boundaries

Coding agents accumulate real understanding of a project: its conventions, its failure modes, the reasoning behind past decisions, the parts that look wrong but are deliberate. Almost all of that understanding is stored per installation. Three ordinary events destroy it.

**The machine boundary.** The same subscription, used on a work machine and a home machine, does not share what either agent learned. Work resumed on the second machine starts from nothing, and the developer pays the explanation cost twice.

**The product boundary.** Moving a task between agent products means restating intent, conventions, constraints, and prior decisions. Restatement is lossy in a specific and expensive way: a partially informed agent is confident rather than cautious, so it introduces new defects while repairing old ones. The cost is not the retyping. The cost is the bugs.

**Environment loss.** Reinstalling an operating system, replacing a laptop, or handing the repository to a colleague discards the accumulated understanding completely. Nothing signals the loss; the next session simply rediscovers what was already known, and often reaches a different conclusion.

None of these are exotic. They are the normal weekly rhythm of working across machines, tools, and teammates. PCP's premise is that the durable place to keep this understanding already exists — the repository — because a repository already survives cloning, machine replacement, tool changes, and onboarding.

## Existing code is the hard case

Greenfield work is not where agent context is most valuable. The difficult case is a substantial codebase that already works, where the agent must honor prior decisions it did not witness. Without persistent context, an agent re-derives the architecture from scratch each session, reaches a plausible but slightly different reading each time, and proposes changes that conflict with constraints nobody wrote down.

A durable, grounded baseline changes agent behavior on exactly this case: the agent starts from what the project actually is, rather than from an inference formed in the first few minutes of reading.

## The layer is deliberately separable

PCP's operating context lives in one directory, kept apart from the source tree. That separation is a design requirement, not an implementation detail, and it buys two independent options:

- **Ignore it.** A team that does not want agent material in its history can exclude the whole layer. Sources stay untangled, and the layer still works locally.
- **Commit it.** A team that does track it gets the useful property: understanding travels with the checkout. Any machine, any teammate, any fresh clone starts informed. Continuity stops depending on which laptop happened to accumulate the knowledge.

The same separation lets the layer be added to a production repository without reorganizing it, and removed without leaving debris in the source.

## Documentation improves as a by-product

Generated project documentation is only as good as the context available when it is generated. An agent working from a grounded baseline — current architecture, real source map, recorded decisions — produces more accurate summaries and README material in less time than one reconstructing the project from a cold read. PCP treats project-outcome documentation as ordinary tracked files outside the context layer and catalogs them from canonical state, so the documents remain the project's own and stay findable.

## What the earlier template got right, and what changed

PCP grew from a portable repository-context template that established the durable ideas: the repository outranks agent memory, exploration is read-only before it is authoritative, knowledge lives in numbered discoverable documents, paths stay relative, and every agent registers before it acts. Those survive in PCP, generalized.

Two mechanisms deliberately did not survive, and the distinction matters when reading older material:

- The template reconstructed current state as _exploration snapshots plus every newer changelog entry_. That works until the changelog grows, at which point reconstruction becomes the expensive path. PCP makes living canonical state authoritative on its own; events explain how the project changed, but current truth is read directly rather than replayed.
- The template required a full re-read at the start of every session. PCP replaces that with mandatory synchronization that reports precisely what changed, so the common case — nothing changed — costs almost nothing.

[Capability lineage and parity](capability-parity.md) records each retained and superseded behavior against public evidence.

## What PCP does not claim

PCP does not make an agent understand a project it has never explored, and it does not replace reading the code. It removes the repeated cost of rebuilding understanding that was already earned, and it makes that understanding survive the boundaries where it previously died.
