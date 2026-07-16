---
id: fleet-polish-2026-07-15-215200
title: Phase 6 — Fleet & Polish
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn:
  - agent-harness-2026-07-15-215200
  - mcp-studio-2026-07-15-215200
todos:
  - id: project-registry
    content: Multi-project registry in {appDataDir}/.pyrola/projects.json (JSON v1; SQLite deferred)
    status: pending
  - id: thread-grouping
    content: Left sidebar — project chat lists + Pinned section (unlimited, cross-project)
    status: pending
  - id: concurrency
    content: fleet.maxConcurrentAgents queue + per-agent Tauri capabilities
    status: pending
  - id: tray
    content: Tray icon + agents continue when window closed
    status: pending
  - id: cost-tracking
    content: Per-turn token cost via tokenlens (see context-usage plan for bucket breakdown)
    status: pending
  - id: cursor-polish
    content: Branch context bar, worked-for timing, collapsed tool summaries
    status: pending
  - id: pdf-v2
    content: PDF export v1.5 (@comark/html) + v2 (native export_studio_pdf)
    status: pending
---

## Summary

Cross-project fleet management, background agents, cost tracking, and Cursor UX polish.

## Fleet data model

**Project registry** in `{appDataDir}/.pyrola/projects.json` + `active-project.json`:

- **Projects** — id, name, slug, rootPath, lastOpened
- **Agent runs** — token usage, cost estimate (optional index)

**Chats** on filesystem only (not SQLite):

```text
~/.pyrola/chats/<project-slug>/<chat-id>/
  meta.json
  messages.jsonl
```

No `<repo>/.pyrola/chats`. UI supports **delete**, **fork**, and **pin/unpin** (unlimited). See [chat-persistence plan](../chat-persistence-2026-07-15-220100/PLAN.md).

## Sidebar

- **Pinned** section — all pinned chats across fleet, no cap, sorted by `pinnedAt`
- **Per-project** thread lists — pinned chats show pin icon; pinned first within project
- Pin/unpin from chat row context menu

## Concurrency

- `fleet.maxConcurrentAgents` from settings
- Each agent scoped to project root via Tauri capabilities
- Queue or reject when limit exceeded

## Tray-resident process

Agents keep running when window is minimized/closed. Work lost only on full quit or OS kill.

## Cursor UX polish

- Git branch in context bar (display only — see [git-informational plan](../git-informational-2026-07-15-221700/PLAN.md))
- "Worked for 57s" timing on agent turns
- Collapsed tool summary rows ("Explored 4 files, 2 searches, 1 tool")
- Per-turn file change summaries (`+30 -5`)

## Security checklist

- API keys only in keychain
- Per-agent capability scoping
- file_mtime before writes
- Plan → review → apply on mutations
- MCP spawn allowlist from config

## Definition of done

- 3+ projects registered with threads visible across fleet
- Agent runs in background after window close
- Cost estimate shown per thread
- PDF v2 works on Windows/macOS (Linux falls back to print dialog)
