---
id: context-usage-2026-07-15-221100
title: Context Usage Monitor
createdAt: 2026-07-16T05:11:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn:
  - agent-harness-2026-07-15-215200
  - contracts-2026-07-15-215200
todos:
  - id: context-buckets
    content: Define ContextBudget type with Cursor-matching buckets + token counts
    status: pending
  - id: context-calculator
    content: use-context-usage composable — count tokens per bucket before each turn
    status: pending
  - id: context-ui
    content: ContextUsagePanel (stacked bar + breakdown list) in chat input area
    status: pending
  - id: context-report
    content: Optional detailed Context Usage report view (View Report link)
    status: pending
  - id: context-warnings
    content: Warn when approaching model context limit (80%, 95%)
    status: pending
---

## Summary

Granular **context window monitoring** matching Cursor's Context Usage panel — critical for hobbyists running local BYOK agents who need to see what's eating their context budget.

## UI reference (match Cursor)

```text
┌─────────────────────────────────────────────┐
│ Context Usage                    View Report│
│ 62% Full                    ~124.5K / 200K  │
│ [████████████████░░░░░░░░░░░░░░░░░░░░░░░░]│
│                                             │
│ ● System prompt                        579  │
│ ● Tool definitions                   10.5K  │
│ ● Rules                               8.6K  │
│ ● Skills                              3.1K  │
│ ● MCP & dynamic tools                 2.5K  │
│ ● Subagent definitions                 981  │
│ ● Conversation                       98.3K  │
└─────────────────────────────────────────────┘
```

Accessible from chat input area (circular % indicator, like Cursor) and expandable to full panel.

## Context buckets

| Bucket | Source | When counted |
|--------|--------|--------------|
| **System prompt** | Base agent instructions + mode prompt | Each turn |
| **Tool definitions** | Built-in tools + active MCP tool schemas | Each turn |
| **Rules** | Injected `.pyrola/rules/*.md` matching globs | Each turn |
| **Skills** | Active `/skill` or selected SKILL.md body | When loaded |
| **MCP & dynamic tools** | MCP server tool schemas not in base set | Each turn |
| **Subagent definitions** | `.pyrola/agents/*.md` available to spawner | Each turn |
| **Conversation** | All messages in current chat thread | Each turn |

### Type

```ts
type ContextBucket =
  | 'systemPrompt'
  | 'toolDefinitions'
  | 'rules'
  | 'skills'
  | 'mcpTools'
  | 'subagentDefinitions'
  | 'conversation'

type ContextBudget = {
  modelId: string
  contextLimit: number          // from tokenlens model catalog
  buckets: Record<ContextBucket, number>
  total: number
  percentFull: number
}
```

## Token counting

Use **`tokenlens`** (already in `package.json`) for model-aware token estimates.

```ts
// src/services/context/count-context-budget.ts
import { countTokens } from 'tokenlens'

// Count each bucket's raw text/JSON separately before assembly
// Sum for total; compare to model context window from tokenlens model registry
```

Count **what will be sent** on the next turn (not just conversation history):

1. Resolve system prompt for current mode
2. Serialize active tool schemas (built-in + MCP)
3. Concatenate injected rules
4. Include loaded skill bodies
5. Serialize subagent definition summaries in registry
6. Sum conversation messages from `messages.jsonl`

Recalculate on: message append, mode change, MCP connect/disconnect, rule/skill injection change.

## UI components

- `src/components/context/ContextUsageIndicator.vue` — small % ring in chat footer
- `src/components/context/ContextUsagePanel.vue` — popover/sheet with stacked bar + list
- `src/components/context/ContextUsageReport.vue` — full breakdown with expandable raw previews per bucket
- `src/composables/use-context-usage.ts` — reactive `ContextBudget`, hooks into harness pre-flight

### Stacked bar colors (match Cursor palette)

| Bucket | Color |
|--------|-------|
| System prompt | gray |
| Tool definitions | purple |
| Rules | green |
| Skills | orange |
| MCP & dynamic tools | violet |
| Subagent definitions | blue |
| Conversation | pink/red |

## Warnings

| Threshold | UX |
|-----------|-----|
| ≥ 80% | Yellow indicator + toast: "Context 80% full — consider starting a new chat" |
| ≥ 95% | Red indicator + harness may truncate rules/skills first (budget-aware injection) |
| 100% | Block send; offer fork chat or clear conversation |

## Harness integration

Before `streamText`, orchestrator calls `countContextBudget()` and emits `context-budget` HarnessEvent so UI updates live during streaming.

Budget-aware rules injection (already planned): when over budget, drop glob-scoped rules lowest priority first; never drop system prompt or active tool schemas.

## Definition of done

- Context Usage panel shows all 7 buckets with token counts
- % full matches model's context window (user-selectable model)
- Updates live as conversation grows and MCP tools connect
- Hobbyist can diagnose "why is my context full" without paying for cloud tooling
- View Report shows expandable raw text per bucket
