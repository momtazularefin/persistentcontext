# Project Continuity

This file is the source of truth for coding agents. Before any task, the agent must read the current workstream and checkpoint. Cache the agent identity for later handoffs. Record every meaningful change in the append-only journal so parallel agents can reconcile their workstreams.
