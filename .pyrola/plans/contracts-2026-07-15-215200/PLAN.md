---
id: contracts-2026-07-15-215200
title: Phase 0 — Shared Contracts
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
todos:
  - id: harness-event
    content: Define HarnessEvent IPC envelope (text-delta, tool-start, tool-result, todo-update, plan-write)
    status: completed
  - id: projects-registry
    content: Zod schema for projects.json + active-project.json (JSON fleet registry)
    status: completed
  - id: config-schemas
    content: Zod schemas for settings.json + mcp.json merge logic
    status: completed
  - id: ui-alias
    content: Fix @/components/ui → @/components/shadcn/ui alias in vite.config.ts
    status: completed
---

## Summary

Freeze shared contracts before any parallel implementation work. Wrong decisions here propagate everywhere.

## Approach

**Do first, solo, no parallelism.**

### HarnessEvent envelope

```ts
type HarnessEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-start'; toolCallId: string; name: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'todo-update'; todos: TodoItem[] }
  | { type: 'plan-write'; planPath: string }
```

### Fleet registry (JSON v1)

`{appDataDir}/.pyrola/projects.json` + `active-project.json` — no SQLite in v1.

Chat messages are **not** in SQLite. See [chat-persistence plan](../chat-persistence-2026-07-15-220100/PLAN.md).

### Chat filesystem (user-level)

```text
{appDataDir}/.pyrola/chats/<project-slug>/<chat-id>/
  meta.json
  messages.jsonl
```

### Config schemas

- [`src/schemas/pyrola-settings.ts`](../../../src/schemas/pyrola-settings.ts)
- [`src/schemas/mcp-config.ts`](../../../src/schemas/mcp-config.ts) — see [mcp-client plan](../mcp-client-2026-07-15-232000/PLAN.md)
- [`src/services/config/load-pyrola-config.ts`](../../../src/services/config/load-pyrola-config.ts)
- [`src/types/pyrola/`](../../../src/types/pyrola/)

### UI alias fix

ai-elements import `@/components/ui/*`; primitives live at `@/components/shadcn/ui/*`. Add Vite alias before using ai-elements.

## Definition of done

- Types compile with `vue-tsc`
- Schema migration function for `"version": 1`
- No feature code merged until contracts are reviewed
