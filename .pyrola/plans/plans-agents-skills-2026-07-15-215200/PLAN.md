---
id: plans-agents-skills-2026-07-15-215200
title: Phase 4 — Plans, Sub-agents, Rules & Skills
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn: agent-harness-2026-07-15-215200
todos:
  - id: plan-format
    content: PLAN.md parser/writer (YAML frontmatter + todos)
    status: completed
  - id: plan-tools
    content: create_plan and update_plan_todo harness tools
    status: completed
  - id: inline-todos
    content: Inline chat todos via ai-elements Task
    status: completed
  - id: sub-agents
    content: Load .pyrola/agents/*.md + spawn_subagent tool
    status: completed
  - id: rules
    content: Load .pyrola/rules/*.md with glob-scoped injection
    status: pending
  - id: skills
    content: Load .pyrola/skills/<name>/SKILL.md on demand
    status: completed
---

## Summary

Runtime plan files, sub-agent definitions, Cursor-style rules, and skills injection.

## Plan file convention

```text
.pyrola/plans/<name-timestamp>/PLAN.md
```

Example: `contracts-2026-07-15-215200/PLAN.md`

### PLAN.md frontmatter

```yaml
---
id: fix-cron-oom-2026-07-15-143022
title: Fix crons OOM
createdAt: 2026-07-15T14:30:22Z
mode: plan
todos:
  - id: dedupe-rows
    content: Dedupe messaging sheet rows
    status: completed
---
```

Plan mode `create_plan` tool writes new directories following `name-timestamp` naming. **Studio mode also has plan tools** (Ask + Plan + studio artifacts).

## Sub-agents (`.pyrola/agents/*.md`)

```yaml
---
name: explore
description: Fast codebase exploration
model: openai/gpt-4o-mini
tools: [grep, read_file, list_dir]
---
System prompt...
```

## Rules (`.pyrola/rules/*.md`)

Frontmatter: `description`, `globs`, `alwaysApply` — inject when working set matches.

## Skills (`.pyrola/skills/<name>/SKILL.md`)

Loaded on `/skill-name` or tool match; injected into system prompt for that turn.

## Definition of done

- Plan mode creates `.pyrola/plans/<name-timestamp>/PLAN.md`
- Studio mode can also create/update plans (superset of Plan)
- Todos update in chat and on disk
- Sub-agent spawn returns summarized result to parent
- Rules inject based on open files / globs
