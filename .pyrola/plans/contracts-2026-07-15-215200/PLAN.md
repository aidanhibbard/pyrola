---
id: contracts-2026-07-15-215200
title: Phase 0 — Shared Contracts
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
todos:
  - id: harness-event
    content: Define HarnessEvent IPC envelope (text-delta, tool-start, tool-result, todo-update, plan-write)
    status: pending
  - id: sqlite-schema
    content: Freeze SQLite schema (projects, threads, messages, tool_results)
    status: pending
  - id: config-schemas
    content: Zod schemas for settings.json + mcp.json merge logic
    status: pending
  - id: ui-alias
    content: Fix @/components/ui → @/components/shadcn/ui alias in vite.config.ts
    status: pending
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

### SQLite tables

- `projects` — id, name, rootPath, lastOpened
- `threads` — id, projectId, title, mode, status, model, createdAt
- `messages` — threadId, parts JSON (AI SDK UIMessage)
- `tool_results` — checkpoint per completed tool call

### Config schemas

- [`src/schemas/pyrola-settings.ts`](../../../src/schemas/pyrola-settings.ts)
- [`src/services/config/load-pyrola-config.ts`](../../../src/services/config/load-pyrola-config.ts)
- [`src/types/pyrola/`](../../../src/types/pyrola/)

### UI alias fix

ai-elements import `@/components/ui/*`; primitives live at `@/components/shadcn/ui/*`. Add Vite alias before using ai-elements.

## Definition of done

- Types compile with `vue-tsc`
- Schema migration function for `"version": 1`
- No feature code merged until contracts are reviewed
