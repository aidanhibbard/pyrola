---
id: ide-shell-2026-07-15-215200
title: Phase 1 — IDE Shell
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn: contracts-2026-07-15-215200
todos:
  - id: router-views
    content: Add router + FleetView, AgentThreadView, SettingsView
    status: completed
  - id: main-layout
    content: Refactor App.vue — left sidebar + main stack (chat/workbench top, terminal bottom)
    status: completed
  - id: workbench-tabs
    content: Tabbed workbench (Changes, Editor, Browser, Studio — no Terminal tab)
    status: completed
  - id: bottom-terminal
    content: Bottom terminal panel (xterm.js) spanning chat + workbench width, bounded by left sidebar
    status: completed
  - id: monaco
    content: Integrate Monaco editor in Editor tab
    status: completed
  - id: file-tree
    content: File tree + folder open dialog (Tauri FS commands stubbed or minimal)
    status: completed
---

## Summary

Build the IDE chrome: left fleet sidebar, center chat + right workbench on top, **bottom terminal** spanning chat and workbench (not under the left sidebar). In-app Monaco editor in workbench.

## Layout

**Differs from Cursor:** terminal is a **bottom panel**, not a right-sidebar tab. It spans the full width of the chat + workbench area and stops at the left sidebar's right edge.

```text
┌─────────────┬──────────────────────────┬─────────────────────┐
│             │ AgentChat (center)       │ Workbench (right)   │
│ LeftSidebar │ - Thread header + todos  │ Changes | Editor    │
│ - NavHeader │ - Message stream         │ Browser | Studio    │
│ - Projects  │ - PromptInput + mode     │                     │
│ - Threads   ├──────────────────────────┴─────────────────────┤
│ - Footer    │ Terminal (bottom — full width of chat+right)  │
│             │ xterm.js + resizable vertical split            │
└─────────────┴────────────────────────────────────────────────┘
```

### Layout structure (Vue)

```text
SidebarProvider
├── LeftSidebar (fixed width)
└── SidebarInset
    └── ResizablePanelGroup (vertical)
        ├── ResizablePanel (top — default ~70%)
        │   └── ResizablePanelGroup (horizontal)
        │       ├── AgentChat (center)
        │       └── Workbench (right, tabbed)
        ├── ResizableHandle (horizontal drag)
        └── ResizablePanel (bottom terminal — collapsible)
            └── TerminalPanel (xterm.js)
```

Terminal left boundary = right edge of `LeftSidebar`. Terminal never renders beneath the sidebar.

## Key files

- [`src/App.vue`](../../../src/App.vue) — nested resizable panel groups
- [`src/router/index.ts`](../../../src/router/index.ts) — register views
- `src/components/workbench/` — Changes, Editor, Browser, Studio tabs
- `src/components/terminal/TerminalPanel.vue` — bottom xterm panel
- `src/components/fleet/` — project list, thread list, status badges

## Left sidebar (stub → wired)

- New Agent, Search, **Pinned** (all pinned chats, unlimited), Repositories, thread history, Settings
- Replace hardcoded sample nav in [`NavHeader.vue`](../../../src/components/navigation/aside/left/NavHeader.vue) — wire Pinned to `list_pinned_chats`

## Workbench tabs (v1)

| Tab | v1 scope |
|-----|----------|
| Changes | Git status + per-turn summaries (informational only — no commit UI) |
| Editor | Monaco + syntax highlighting |
| Browser | Tauri webview placeholder |
| Studio | Comark placeholder → Phase 5 |

## Bottom terminal (v1)

| Concern | Approach |
|---------|----------|
| Position | Bottom panel, spans chat + workbench columns |
| Boundary | Left edge at right border of `LeftSidebar` |
| Resize | Vertical `ResizableHandle` between top stack and terminal |
| Collapse | Toggle from title bar or keyboard shortcut |
| Backend | xterm.js placeholder → `portable-pty` in Phase 3 |

## Status (updated 2026-07-17)

What shipped vs. the original Phase 1 spec:

- **Layout** — Left sidebar + horizontal chat/workbench split + bottom terminal panel with vertical resize; terminal spans chat+workbench only (not under sidebar).
- **Router** — `HomePage` (fleet home), `AgentThreadView`, and `SettingsView` routes; no separate `FleetView`.
- **Workbench tabs** — Editor, Terminal, Browser, and Changes (git status). Plan and Studio are **chat modes**, not workbench tab types; `+` menu no longer offers them.
- **Monaco editor** — Writable multi-file sub-tabs with per-file dirty tracking, Cmd+S save, and close-with-dirty confirmation.
- **File tree** — VS Code-style context menu (copy relative/absolute path, reveal in Finder).
- **Markdown preview** — `.md` files in the editor tab support Edit / Split / Preview modes.
- **Terminal** — xterm.js bottom panel with `portable-pty` backend for `run_terminal`; collapsible via title bar.
- **Duplicate tabs** — AlertDialog when opening an already-open file path, with never-ask-again setting.
- **Settings** — Moved from `NavHeader` to `SidebarFooter` (`NavFooter`).

## Definition of done

- Main layout resizes correctly (sidebar / top stack / bottom terminal)
- Terminal spans chat+workbench width only, not under sidebar
- Terminal collapses and expands via vertical resize
- Monaco opens files from file tree
- Router navigates between fleet and thread views
- `tsc` + `lint` pass
