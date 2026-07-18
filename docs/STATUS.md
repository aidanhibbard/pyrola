# Pyrola Roadmap Status

**Updated:** 2026-07-17

The roadmap to transform Pyrola into a **local-first, BYOK agent IDE** is **feature-complete** for v1. All six master-plan steps have shipped; CI is green (lint, type-check, 59 vitest tests, build).

See the [master plan](../.pyrola/plans/pyrola-master-plan-2026-07-15-215200/PLAN.md) and [implementation roadmap](../.pyrola/plans/implementation-roadmap-2026-07-15-222700/PLAN.md) for the original sequencing.

## Master plan steps

| Step | Focus | Status |
|------|-------|--------|
| 1 | Settings — BYOK, providers, MCP auth/config | Completed |
| 2 | Chats — streaming harness + persistence | Completed |
| 3 | MCP runtime — connect, tools, `call_mcp_tool` | Completed |
| 4 | Right sidebar — Plans + Studio workbench tabs | Completed |
| 5 | IDE — Monaco, terminal, diffs, Changes, browser | Completed |
| 6 | Fleet, pinned chats, context usage, polish | Completed |

## What's done

### Harness & tools

- Local `streamText` transport and orchestrator with tool loop ([agent-harness](../.pyrola/plans/agent-harness-2026-07-15-215200/PLAN.md))
- Four chat modes (Ask, Plan, Studio, Agent) with mode skills and tool allowlists ([plans-agents-skills](../.pyrola/plans/plans-agents-skills-2026-07-15-215200/PLAN.md))
- Built-in file/git/terminal tools; MCP via `call_mcp_tool` ([mcp-client](../.pyrola/plans/mcp-client-2026-07-15-232000/PLAN.md))
- `ask_user` question gate with pause/resume; read-only `spawn_subagent` drill-down
- Inline plan todos in chat; extracted prompts (`src/prompts/` + `load-prompt`)
- First-party web search removed — search is MCP-only

### Chat UX

- Streaming thread UI with tool runs, inline file diffs, artifact links
- Chat message edit/reset with truncation
- Pin/unpin chats; command palette (Cmd+K)
- Per-role model picker ([ModelsSection](../src/components/settings/sections/ModelsSection.vue))
- Context usage indicator with bucket breakdown ([context-usage](../.pyrola/plans/context-usage-2026-07-15-221100/PLAN.md))

### Plans & Studio

- Zod plan document schema + canonical `PLAN.md` validation ([plans-agents-skills](../.pyrola/plans/plans-agents-skills-2026-07-15-215200/PLAN.md))
- Plan build UX (Done/Build/Built states, model picker, resume or new chat)
- Studio platform v2 — artifact library, source/preview split, debounced save, 4 templates, Comark blocks ([mcp-studio](../.pyrola/plans/mcp-studio-2026-07-15-215200/PLAN.md))
- Studio document schema (Zod frontmatter + block props + `data.json`)

### Editor & workbench

- Writable Monaco with multi-file sub-tabs, Cmd+S save, dirty tracking ([ide-shell](../.pyrola/plans/ide-shell-2026-07-15-215200/PLAN.md))
- Workbench tabs: Editor, Terminal, Browser, Changes (Plan/Studio are chat modes only)
- File tree context menu; markdown Edit/Split/Preview
- Duplicate-tab dialog with never-ask-again setting
- Informational git Changes tab ([git-informational](../.pyrola/plans/git-informational-2026-07-15-221700/PLAN.md))

### Settings & fleet

- BYOK config loader, keychain, HTTP proxy ([config-providers](../.pyrola/plans/config-providers-2026-07-15-215200/PLAN.md))
- Settings UI — Personal + Project tabs, providers, MCP CRUD ([settings-ui](../.pyrola/plans/settings-ui-2026-07-15-221100/PLAN.md))
- Multi-project fleet registry; add project; project context menu (Open Editor, Open Terminal)
- Chat persistence under `~/.pyrola/chats/<project-slug>/` ([chat-persistence](../.pyrola/plans/chat-persistence-2026-07-15-220100/PLAN.md))
- System tray icon — window-close-to-tray keeps agents running; tray click restores window (gated by `fleet.trayBackground`)
- CLI `pyrola .` launch args + PATH install docs

### Docs / infra

- Shared contracts and schemas ([contracts](../.pyrola/plans/contracts-2026-07-15-215200/PLAN.md))
- UI panel specs ([ui-design-index](../.pyrola/plans/ui-design-index-2026-07-15-230000/PLAN.md))
- Icon button tooltip audit across the app

## Known limitations / out of scope (v1)

- **LSP** — Editor UI integration is stubbed/phased; no language-server wiring in v1.
- **Cloud sync** — No accounts or remote chat/project sync.
- **Sub-agents** — Read-only v1 (`spawn_subagent` does not mutate files).
- **MCP OAuth** — Full OAuth 2.1 flow not yet implemented; stdio/Bearer servers work.
- **Rules injection** — Rule files are listed in context; glob-scoped content injection is not complete.
- **Write approval gate** — Shadow-path Monaco diff approval for `write_file` not shipped.
- **Chunk-size build warnings** — Pre-existing Vite chunk warnings; build passes.

## Verification

All checks pass as of 2026-07-17:

```bash
npm run lint
npm run type-check
npx vitest run    # 59/59
npm run build
```
