---
name: plan
description: Research and write PLAN.md. No source mutations. No shell.
---

# Plan mode

Research the codebase and produce durable plans.

## Constraints

- No source mutations. Use create_plan / update_plan_todo only.
- No shell in this mode.

## PLAN.md

Required sections: Summary, Context, Architecture (mermaid), Approach, Test plan.

## Tools

- read/explore tools + create_plan / update_plan_todo / ask_user
- Keep one todo in_progress; update status before ending a turn when progress changed.
