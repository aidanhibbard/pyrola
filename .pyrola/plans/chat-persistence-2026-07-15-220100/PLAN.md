---
id: chat-persistence-2026-07-15-220100
title: Chat Persistence & Management
createdAt: 2026-07-16T05:01:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn:
  - contracts-2026-07-15-215200
  - agent-harness-2026-07-15-215200
todos:
  - id: chat-dir-layout
    content: Define {appDataDir}/.pyrola/chats/<project-slug>/<chat-id>/ on-disk layout
    status: pending
  - id: chat-schema
    content: Zod schema for meta.json + messages.jsonl (AI SDK UIMessage parts)
    status: pending
  - id: chat-service
    content: Chat CRUD service (create, load, append, checkpoint, list by project)
    status: pending
  - id: delete-chat
    content: UI + command to delete a chat (remove directory)
    status: pending
  - id: fork-chat
    content: UI + command to duplicate/fork a chat (copy dir, new id, forkedFrom meta)
    status: pending
  - id: sidebar-integration
    content: Left sidebar lists chats from {appDataDir}/.pyrola/chats/<project-slug>/
    status: pending
  - id: pin-chat
    content: Pin/unpin chats (unlimited) — pinned field in meta.json + Pinned sidebar section
    status: pending
---

## Summary

Chats are **user-level only**, organized per project. No `<repo>/.pyrola/chats` — project repos never store chat history.

## Directory layout

```text
{appDataDir}/.pyrola/
  chats/
    <project-slug>/              # e.g. platform, pyrola, marketing
      <chat-id>/                 # nanoid or uuid
        meta.json                # title, mode, model, status, timestamps
        messages.jsonl           # one JSON line per message part checkpoint
```

**Not in project repos:**

```text
<repo>/.pyrola/
  settings.json
  mcp.json
  agents/ skills/ rules/ plans/ studio/
  # NO chats/ directory
```

### Project slug

Derived from the registered project in the fleet registry — default to sanitized basename of `rootPath` (e.g. `/Users/me/code/platform` → `platform`). Collisions resolved with suffix (`platform-2`).

### meta.json

```jsonc
{
  "id": "abc123",
  "title": "Crons memory restarts",
  "projectSlug": "platform",
  "projectRoot": "/Users/me/code/platform",
  "mode": "agent",
  "model": "anthropic/claude-sonnet-4",
  "status": "idle",
  "createdAt": "2026-07-15T14:30:00Z",
  "updatedAt": "2026-07-15T15:12:00Z",
  "forkedFrom": null,
  "pinned": false,
  "pinnedAt": null
}
```

On fork: new `id`, `forkedFrom` set to source chat id, `createdAt` reset, `messages.jsonl` copied.

### messages.jsonl

Append-only checkpoint stream for resume-after-relaunch:

```jsonl
{"type":"message","role":"user","parts":[...],"timestamp":"..."}
{"type":"message","role":"assistant","parts":[...],"timestamp":"..."}
{"type":"tool-result","toolCallId":"...","result":{...},"timestamp":"..."}
```

Harness appends after each completed tool result (crash-safe tail).

## UI actions

| Action | Behavior |
|--------|----------|
| **New chat** | Create `<chat-id>/` under `{appDataDir}/.pyrola/chats/<project-slug>/` |
| **Delete chat** | Confirm dialog → `rm -rf` chat directory via Tauri fs command |
| **Duplicate / fork** | Copy source directory → new `<chat-id>/` → update `meta.json` (`forkedFrom`, new `id`, new timestamps) → open forked chat |
| **Rename** | Update `meta.json` title only |
| **Pin / Unpin** | Toggle `pinned` + set `pinnedAt` in `meta.json` — **no limit** on pin count |

Fork preserves full message history so the user can branch exploration without losing the original thread.

## Pinned conversations

**Unlimited pins** — no cap. A user can pin every chat if they want.

### Storage

Pin state lives in each chat's `meta.json` (`pinned: boolean`, `pinnedAt: ISO timestamp`). No separate index file — scan all `{appDataDir}/.pyrola/chats/*/*/meta.json` where `pinned === true`.

### Sidebar UX

Wire existing [`NavHeader.vue`](../../../src/components/navigation/aside/left/NavHeader.vue) **Pinned** menu:

```text
LeftSidebar
├── New Agent
├── Search
├── Pinned                    ← all pinned chats, any project
│   ├── Crons memory restarts   (platform)
│   ├── Yelp ad spend analysis  (marketing)
│   └── ...
├── Repositories
│   └── platform
│       ├── Sentry MCP review   (unpinned, recent)
│       └── ...
```

- **Pinned section** — flat list of all pinned chats across fleet, sorted by `pinnedAt` desc (most recently pinned first)
- **Project threads** — pinned chats **also** appear in their project list with a pin icon; unpinning removes from Pinned section only
- **Pin toggle** — context menu on any chat row: Pin / Unpin
- **No maximum** — list grows with however many the user pins

### List queries

- `list_chats { projectSlug }` — all chats for project (pinned first, then `updatedAt` desc)
- `list_pinned_chats {}` — all pinned across all projects (for Pinned sidebar section)

### Fork behavior

Forked chat inherits `pinned: false` unless user explicitly pins the fork.

## Relationship to SQLite

`{appDataDir}/.pyrola/projects.json` holds **project registry only** — `id`, `name`, `rootPath`, `slug`, `lastOpened`. Chat content is **never** in SQLite.

## Key modules

- `src/schemas/chat-meta.ts`
- `src/services/chat/list-chats.ts`
- `src/services/chat/load-chat.ts`
- `src/services/chat/append-message.ts`
- `src/services/chat/delete-chat.ts`
- `src/services/chat/fork-chat.ts`
- `src/services/chat/pin-chat.ts`
- `src/services/chat/list-pinned-chats.ts`
- `src/composables/use-chat-store.ts`
- `src/components/fleet/ChatListItem.vue` — delete, fork, pin/unpin actions
- `src/components/fleet/PinnedChatList.vue` — NavHeader Pinned dropdown / section

## Tauri commands

- `list_chats { projectSlug }`
- `read_chat_meta { projectSlug, chatId }`
- `append_chat_line { projectSlug, chatId, line }`
- `delete_chat { projectSlug, chatId }`
- `fork_chat { projectSlug, sourceChatId }` → returns new chat id
- `pin_chat { projectSlug, chatId, pinned }` → updates meta.json
- `list_pinned_chats {}` → all pinned across projects

## Definition of done

- Chats persist under `{appDataDir}/.pyrola/chats/<project-slug>/` only
- No chat files written to project `.pyrola/`
- User can delete, fork, and pin/unpin chats from sidebar
- Pinned section shows unlimited pinned chats across all projects
- Agent stream resumes from last checkpoint after app relaunch
- Forked chat opens with full copied history
