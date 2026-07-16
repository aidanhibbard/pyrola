---
id: pyrola-master-plan-2026-07-15-215200
title: Pyrola Master Plan
createdAt: 2026-07-16T04:52:00Z
mode: plan
todos:
  - id: step-1-settings
    content: "Step 1: Settings — BYOK, providers, MCP auth/config, personal + project tabs"
    status: pending
  - id: step-2-chats
    content: "Step 2: Chats — streaming harness + persistence (after settings)"
    status: pending
  - id: step-3-mcps
    content: "Step 3: MCP runtime — connect, tools, call_mcp_tool (after chat)"
    status: pending
  - id: step-4-sidebar
    content: "Step 4: Right sidebar — Plans + Studio workbench tabs"
    status: pending
  - id: step-5-ide
    content: "Step 5: IDE — Monaco, bottom terminal, diffs, Changes, browser"
    status: pending
  - id: step-6-polish
    content: "Step 6: Fleet, pinned chats, context usage, tray, polish"
    status: pending
---

## Summary

Transform Pyrola's Tauri + Vue shell into a **local-first, BYOK, open-source agent IDE** matching Cursor Agents UX — with fleet management across projects, four chat modes (Agent, Plan, Ask, Studio), MCP/skills/sub-agents, and in-app editor/terminal/browser/studio panels.

## Chat modes (capability ladder)

| Mode | Capabilities | Writes files |
|------|--------------|--------------|
| **Ask** | Read-only exploration (grep, read, MCP read) | No |
| **Plan** | Ask + create/update plans | `.pyrola/plans/<name-timestamp>/PLAN.md` |
| **Studio** | Ask + Plan + studio artifacts & Comark reports | Plans + `.pyrola/studio/<slug>/` |
| **Agent** | Full mutating harness | Project source (gated) |

Ask does everything Plan/Studio can do for exploration — it just doesn't persist output to disk.

## Implementation order

**Authoritative build sequence** — see [implementation-roadmap](../implementation-roadmap-2026-07-15-222700/PLAN.md):

| Step | Focus | Depends on |
|------|-------|------------|
| **1** | Settings — BYOK, providers, MCP auth/config | — |
| **2** | Chats — streaming, persistence, basic UI | Step 1 |
| **3** | MCPs — connect, tools, `call_mcp_tool` | Step 2 |
| **4** | Right sidebar — Plans + Studio | Step 3 |
| **5** | IDE — terminal, Monaco, diffs, Changes, browser | Step 4 |
| **6** | Polish — fleet, pins, context usage, tray, remainder | Step 5 |

Child plans below are detailed specs; the roadmap defines build order.

## Plan file convention

All plans live under `.pyrola/plans/` using **`name-timestamp/PLAN.md`**:

```text
.pyrola/plans/
  pyrola-master-plan-2026-07-15-215200/PLAN.md   ← this file
  contracts-2026-07-15-215200/PLAN.md
  ide-shell-2026-07-15-215200/PLAN.md
  ...
```

- **name** — kebab-case slug describing the plan
- **timestamp** — `YYYY-MM-DD-HHmmss` (UTC) at creation time

## Child plans

| Plan | Path |
|------|------|
| **Implementation Roadmap** | [implementation-roadmap-2026-07-15-222700/PLAN.md](../implementation-roadmap-2026-07-15-222700/PLAN.md) |
| Contracts | [contracts-2026-07-15-215200/PLAN.md](../contracts-2026-07-15-215200/PLAN.md) |
| IDE Shell (Phase 1) | [ide-shell-2026-07-15-215200/PLAN.md](../ide-shell-2026-07-15-215200/PLAN.md) |
| Config & Providers (Phase 2) | [config-providers-2026-07-15-215200/PLAN.md](../config-providers-2026-07-15-215200/PLAN.md) |
| Agent Harness (Phase 3) | [agent-harness-2026-07-15-215200/PLAN.md](../agent-harness-2026-07-15-215200/PLAN.md) |
| Plans, Agents, Skills (Phase 4) | [plans-agents-skills-2026-07-15-215200/PLAN.md](../plans-agents-skills-2026-07-15-215200/PLAN.md) |
| MCP & Studio (Phase 5) | [mcp-studio-2026-07-15-215200/PLAN.md](../mcp-studio-2026-07-15-215200/PLAN.md) |
| Fleet & Polish (Phase 6) | [fleet-polish-2026-07-15-215200/PLAN.md](../fleet-polish-2026-07-15-215200/PLAN.md) |
| Chat Persistence | [chat-persistence-2026-07-15-220100/PLAN.md](../chat-persistence-2026-07-15-220100/PLAN.md) |
| Settings UI | [settings-ui-2026-07-15-221100/PLAN.md](../settings-ui-2026-07-15-221100/PLAN.md) |
| Git Informational | [git-informational-2026-07-15-221700/PLAN.md](../git-informational-2026-07-15-221700/PLAN.md) |
| Context Usage | [context-usage-2026-07-15-221100/PLAN.md](../context-usage-2026-07-15-221100/PLAN.md) |

## Vision

- **BYOK** via Vercel AI SDK providers (OpenAI, Anthropic, Google, OpenRouter, self-hosted)
- **No cloud agents, no accounts** — keys in OS keychain
- **Fleet management** — agents across multiple unrelated projects
- **VS Code-shaped config** — `~/.pyrola/` (user) + `<repo>/.pyrola/` (project; project wins)

## Architecture

```mermaid
flowchart TB
  subgraph ui [Vue UI]
    LeftSidebar[LeftSidebar]
    ChatPane[ChatPane]
    Workbench[Workbench]
  end
  subgraph harness [Agent Harness]
    Orchestrator[Orchestrator]
    LocalTransport[LocalChatTransport]
    ToolRouter[ToolRouter]
    MCPClient[MCPClient]
  end
  subgraph rust [Tauri Rust]
    FsOps[fs]
    Pty[pty]
    HttpProxy[HTTP proxy]
    Keychain[keychain]
  end
  ChatPane --> Orchestrator
  Orchestrator --> LocalTransport --> HttpProxy
  Orchestrator --> ToolRouter --> FsOps
  ToolRouter --> Pty
  Orchestrator --> MCPClient
```

## Config precedence

`~/.pyrola/settings.json` → `<repo>/.pyrola/settings.json` (project wins). Chats live at `~/.pyrola/chats/<project-slug>/` only — never in project repos.

## Success criteria

1. Register 3+ project roots with agent threads across all
2. Run Agent-mode with BYOK, streaming tools, inline todos
3. Plan mode writes `.pyrola/plans/<name-timestamp>/PLAN.md` with trackable todos
4. Studio mode generates Comark reports via MCP data sources
5. Monaco editor, bottom terminal (chat+workbench width), browser in workbench
6. Tray-resident agents; resume on reopen
7. No accounts or subscriptions

## Out of scope (v1)

Cloud sync, embeddings/vector DB, LSP, full in-app diff renderer, VS Code extension for dirty buffers, mobile check-in.
