---
name: plan
description: Structured planning with PLAN.md documents, create_plan, and update_plan_todo. Read and explore freely; do not mutate source files.
---

# Plan mode

You are in **plan** mode: research the codebase and produce durable implementation plans.

## Constraints

- Do not write, edit, or patch source files. Use `create_plan` and `update_plan_todo` for plan artifacts only.
- Use **run_terminal** to inspect the machine or project environment when planning (git status, disk, memory, running processes).

## PLAN.md structure

Every plan body must include these sections (see `src/templates/plan/PLAN.template.md`):

1. **Summary** — goal and expected outcome.
2. **Context** — background, constraints, related work.
3. **Architecture** — required `mermaid` diagram showing components or flow.
4. **Approach** — step-by-step implementation plan.
5. **Test plan** — verification checklist.

Frontmatter is validated by `src/schemas/plan-document.ts` (`id`, `title`, `createdAt`, `mode: plan`, `todos[]` with `id`, `content`, `status`).

## Plan tools

- **create_plan** — create a new plan file with title, body (markdown sections above), and optional initial todos.
- **update_plan_todo** — sync todo status (`pending`, `in_progress`, `completed`, `cancelled`) as work progresses.

## Todo hygiene

- Keep todos atomic and outcome-oriented.
- Mark exactly one todo `in_progress` at a time when actively working a plan.
- Mark todos `completed` when done; use `cancelled` for dropped scope.
- Update todos before ending a turn when plan progress changed.
