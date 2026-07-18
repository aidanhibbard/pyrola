---
id: implementation-roadmap-2026-07-15-222700
title: Implementation Roadmap
createdAt: 2026-07-16T05:27:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
todos:
  - id: step-1-settings
    content: "Step 1: Settings — BYOK providers, MCP config/auth, personal + project tabs"
    status: completed
  - id: step-2-chats
    content: "Step 2: Chats — streaming harness, persistence, basic chat UI (needs Step 1)"
    status: completed
  - id: step-3-mcps
    content: "Step 3: MCP runtime — connect, refresh, list tools, call_mcp_tool (needs Step 2)"
    status: completed
  - id: step-4-sidebar
    content: "Step 4: Right sidebar — Plans + Studio workbench tabs (needs Step 3)"
    status: completed
  - id: step-5-ide
    content: "Step 5: IDE — Monaco, bottom terminal, diffs, Changes, browser (needs Step 4)"
    status: completed
  - id: step-6-polish
    content: "Step 6: Fleet, pinned chats, context usage, tray, sub-agents, polish"
    status: completed
---

## Summary

Authoritative **build order** for Pyrola. Each step depends on the previous. Child plan files remain the detailed specs; this roadmap defines *when* to build them.

```mermaid
flowchart LR
  S1[1 Settings] --> S2[2 Chats]
  S2 --> S3[3 MCPs]
  S3 --> S4[4 Plans Studio]
  S4 --> S5[5 IDE Terminal]
  S5 --> S6[6 Polish]
```

---

## Step 1 — Settings

**Goal:** User can configure everything before chatting.

| Deliverable | Child plan |
|-------------|------------|
| Config loader (`~/.pyrola` + `.pyrola`, project wins) | [config-providers](../config-providers-2026-07-15-215200/PLAN.md) |
| Keychain + Rust HTTP proxy | [config-providers](../config-providers-2026-07-15-215200/PLAN.md) |
| Settings page — Personal + Project tabs | [settings-ui](../settings-ui-2026-07-15-221100/PLAN.md) |
| BYOK — all AI SDK providers + custom OpenAI-compatible | [settings-ui](../settings-ui-2026-07-15-221100/PLAN.md) |
| MCP CRUD, auth, refresh, logout, show tools | [settings-ui](../settings-ui-2026-07-15-221100/PLAN.md) |
| Theme + glass preferences | [settings-ui](../settings-ui-2026-07-15-221100/PLAN.md) |
| Minimal contracts (config schemas, ui alias) | [contracts](../contracts-2026-07-15-215200/PLAN.md) |

**Done when:** User can add an API key, configure MCP servers, authenticate, and pick a default model — without chat working yet.

**Not in this step:** Chat UI, MCP tool execution, workbench panels, terminal.

---

## Step 2 — Chats

**Goal:** Streaming conversation with BYOK providers. No MCP tools yet.

| Deliverable | Child plan |
|-------------|------------|
| `LocalChatTransport` + `streamText` | [agent-harness](../agent-harness-2026-07-15-215200/PLAN.md) |
| Chat UI (ai-elements Conversation, PromptInput, Message) | [agent-harness](../agent-harness-2026-07-15-215200/PLAN.md) |
| `~/.pyrola/chats/<project-slug>/` persistence | [chat-persistence](../chat-persistence-2026-07-15-220100/PLAN.md) |
| Ask mode (read-only, no file writes) | [agent-harness](../agent-harness-2026-07-15-215200/PLAN.md) |
| Minimal layout — center chat pane only | [ide-shell](../ide-shell-2026-07-15-215200/PLAN.md) (partial) |
| Left sidebar — chat list, new chat | [chat-persistence](../chat-persistence-2026-07-15-220100/PLAN.md) |

**Done when:** User can open app → pick provider → send messages → see streamed replies → chats persist across relaunch.

**Not in this step:** MCP `call_mcp_tool`, Plan/Studio modes, right workbench, terminal, file editing tools.

---

## Step 3 — MCPs

**Goal:** MCP servers connect and agents can call tools.

| Deliverable | Child plan |
|-------------|------------|
| MCP transports (stdio, HTTP, SSE) + all auth types | [mcp-client](../mcp-client-2026-07-15-232000/PLAN.md) |
| MCP client lifecycle (start, stop, refresh, logout) | [mcp-client](../mcp-client-2026-07-15-232000/PLAN.md) |
| `call_mcp_tool` in harness | [mcp-client](../mcp-client-2026-07-15-232000/PLAN.md) |
| Tool cards in chat stream | [agent-harness](../agent-harness-2026-07-15-215200/PLAN.md) |
| Agent mode with built-in read tools (grep, read_file, git read) | [agent-harness](../agent-harness-2026-07-15-215200/PLAN.md) |
| Settings MCP status + tools list (live) | [settings-ui](../settings-ui-2026-07-15-221100/PLAN.md) |

**Done when:** User configures Postgres MCP in Settings → chats in Agent mode → agent calls MCP tools → results stream in chat.

**Not in this step:** Plan/Studio workbench tabs, Comark renderer, Monaco, terminal.

---

## Step 4 — Right sidebar: Plans + Studio

**Goal:** Workbench panel with Plan and Studio modes fully working.

| Deliverable | Child plan |
|-------------|------------|
| Right workbench opens with tabs | [ide-shell](../ide-shell-2026-07-15-215200/PLAN.md) (partial) |
| Plan mode + `create_plan` / `update_plan_todo` | [plans-agents-skills](../plans-agents-skills-2026-07-15-215200/PLAN.md) |
| `.pyrola/plans/<name-timestamp>/PLAN.md` read/write | [plans-agents-skills](../plans-agents-skills-2026-07-15-215200/PLAN.md) |
| Studio mode + Comark renderer | [mcp-studio](../mcp-studio-2026-07-15-215200/PLAN.md) |
| Studio workbench tab (live preview) | [mcp-studio](../mcp-studio-2026-07-15-215200/PLAN.md) |
| Inline chat todos (ai-elements Task) | [plans-agents-skills](../plans-agents-skills-2026-07-15-215200/PLAN.md) |
| PDF export v1 (print) | [mcp-studio](../mcp-studio-2026-07-15-215200/PLAN.md) |

**Done when:** User can switch to Plan mode → get persisted PLAN.md with todos; switch to Studio → MCP data drives Comark report in right panel.

**Not in this step:** Editor, Terminal, Changes, Browser tabs; file write approval gate.

---

## Step 5 — IDE: Terminal, diffs, editor

**Goal:** Full IDE shell around the chat + sidebar.

| Deliverable | Child plan |
|-------------|------------|
| Full three-zone layout + bottom terminal | [ide-shell](../ide-shell-2026-07-15-215200/PLAN.md) |
| Monaco editor tab | [ide-shell](../ide-shell-2026-07-15-215200/PLAN.md) |
| Bottom terminal (xterm + PTY) | [ide-shell](../ide-shell-2026-07-15-215200/PLAN.md) |
| Changes tab (informational git) | [git-informational](../git-informational-2026-07-15-221700/PLAN.md) |
| Read-only diffs in Monaco | [git-informational](../git-informational-2026-07-15-221700/PLAN.md) |
| Browser workbench tab | [ide-shell](../ide-shell-2026-07-15-215200/PLAN.md) |
| `write_file` + diff approval gate | [agent-harness](../agent-harness-2026-07-15-215200/PLAN.md) |
| File tree + folder open | [ide-shell](../ide-shell-2026-07-15-215200/PLAN.md) |

**Done when:** User can open files in Monaco, see git changes, run terminal at bottom, browse URLs — while chatting with agents.

---

## Step 6 — Polish + remainder

**Goal:** Fleet management, UX polish, and everything left.

| Deliverable | Child plan |
|-------------|------------|
| Multi-project fleet registry | [fleet-polish](../fleet-polish-2026-07-15-215200/PLAN.md) |
| Pinned chats (unlimited) | [chat-persistence](../chat-persistence-2026-07-15-220100/PLAN.md) |
| Context Usage monitor (7 buckets) | [context-usage](../context-usage-2026-07-15-221100/PLAN.md) |
| Sub-agents, rules, skills | [plans-agents-skills](../plans-agents-skills-2026-07-15-215200/PLAN.md) |
| Tray-resident background agents | [fleet-polish](../fleet-polish-2026-07-15-215200/PLAN.md) |
| Cursor UX polish (branch bar, timing, tool summaries) | [fleet-polish](../fleet-polish-2026-07-15-215200/PLAN.md) |
| PDF export v1.5 + v2 | [mcp-studio](../mcp-studio-2026-07-15-215200/PLAN.md) |
| Fork/delete chat, cost tracking | [chat-persistence](../chat-persistence-2026-07-15-220100/PLAN.md), [fleet-polish](../fleet-polish-2026-07-15-215200/PLAN.md) |

**Done when:** Success criteria in master plan all pass.

---

## Mapping: old phases → new steps

| Old phase | New step |
|-----------|----------|
| Phase 0 Contracts | Step 1 (minimal) + ongoing |
| Phase 2 Config | Step 1 |
| Settings UI | Step 1 |
| Phase 3 Harness | Step 2 + 3 + 5 |
| Chat persistence | Step 2 + 6 |
| Phase 5 MCP | Step 3 |
| Phase 4 Plans | Step 4 |
| Studio / Comark | Step 4 |
| Phase 1 IDE shell | Step 2 (minimal) + 4 (partial) + 5 (full) |
| Git informational | Step 5 |
| Phase 6 Fleet | Step 6 |
| Context usage | Step 6 |
