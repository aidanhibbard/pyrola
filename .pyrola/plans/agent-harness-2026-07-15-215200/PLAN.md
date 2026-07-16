---
id: agent-harness-2026-07-15-215200
title: Phase 3 — Agent Harness
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn:
  - contracts-2026-07-15-215200
  - config-providers-2026-07-15-215200
  - ide-shell-2026-07-15-215200
todos:
  - id: local-transport
    content: LocalChatTransport calling streamText directly (no HTTP route)
    status: pending
  - id: orchestrator
    content: Agent orchestrator with tool loop and HarnessEvent emission
    status: pending
  - id: builtin-tools
    content: Built-in tools (read_file, write_file, grep, git, run_terminal) via Tauri invoke
    status: pending
  - id: chat-ui
    content: Wire ai-elements Conversation, Message, Tool, PromptInput to harness
    status: pending
  - id: session-persist
    content: Incremental message persistence + resume on relaunch
    status: pending
  - id: chat-modes
    content: Mode switching (Agent, Plan, Ask, Studio) with tool allowlists
    status: pending
  - id: approval-gate
    content: write_file shadow path → Monaco diff → user approve
    status: pending
---

## Summary

Core agent runtime: local AI SDK inference, tool execution through Rust, streaming chat UI, four modes.

## Chat modes

Modes form a **capability ladder**. Higher modes include everything below them (except Agent, which is separate and fully mutating).

| Mode | Capabilities | Writes to disk |
|------|--------------|----------------|
| **Ask** | Read-only exploration (grep, read_file, list_dir, git read, MCP read) | **No** — session only |
| **Plan** | Everything **Ask** + `create_plan`, `update_plan_todo` | `.pyrola/plans/<name-timestamp>/PLAN.md` |
| **Studio** | Everything **Ask** + **Plan** + `write_studio_artifact`, Comark preview, report MCPs | Plans **and** `.pyrola/studio/<slug>/` |
| **Agent** | Full harness (fs write, shell, sub-agents, etc.) | Project files (gated) |

**Ask** is Plan/Studio without persistence — same exploration tools, no files generated.

## Built-in tools

| Tool | Backend |
|------|---------|
| read_file, write_file, list_dir | Tauri fs + mtime check |
| grep | ripgrep spawn |
| run_terminal | PTY → bottom `TerminalPanel` |
| git_status, git_diff | git CLI |

All mutating tools go through `invoke()`. Checkpoint after each completed tool result.

## Tauri commands (this phase)

- `fs` — read, write, list, watch, mtime
- `shell` — spawn_pty, write_pty, resize_pty
- `git` — status, diff, log

## Key modules

- `src/composables/use-agent-harness.ts`
- `src/services/harness/`
- `src/components/agent/` — ai-elements wrappers

## Definition of done

- Agent mode streams text + tool cards in chat
- Sessions survive app restart
- write_file requires diff approval
- Ask mode cannot write any files
- Plan mode can write PLAN.md only (not studio or project files)
- Studio mode can write plans and studio artifacts (not project source files)
