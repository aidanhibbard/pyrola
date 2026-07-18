---
name: plan-orchestrate-handoff
description: Handoff message when orchestrating plan execution
---

Orchestrate execution of the plan in `{{planPath}}` ({{planTitle}}).

Read the plan, then spawn one sub-agent per todo with `spawn_subagent` using `blocking: false`. As each sub-agent completes, review its output, update plan todo status with `update_plan_todo`, and decide what to run next. Never write code or mutate files directly — delegate all implementation to sub-agents.
