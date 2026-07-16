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
    content: Built-in tools (read_file, write_file, grep, git read-only, run_terminal) via Tauri invoke
    status: pending
  - id: chat-ui
    content: Wire ai-elements Conversation, Message, Tool, PromptInput to harness
    status: pending
  - id: session-persist
    content: Incremental append to ~/.pyrola/chats/<project-slug>/<chat-id>/messages.jsonl + resume
    status: pending
  - id: chat-modes
    content: Mode switching (Agent, Plan, Ask, Studio) with tool allowlists
    status: pending
  - id: context-integration
    content: Emit context-budget HarnessEvent; wire ContextUsageIndicator in chat footer
    status: pending
  - id: approval-gate
    content: write_file shadow path → Monaco diff → user approve
    status: pending

## Summary

Core agent runtime: local AI SDK inference, tool execution through Rust, streaming chat UI, four modes.

## Chat modes

Modes form a **capability ladder**. Higher modes include everything below them (except Agent, which is separate and fully mutating).

| Mode | Capabilities | Writes to disk |
|------|--------------|----------------|
| **Ask** | Read-only exploration (grep, read_file, list_dir, git read, MCP read) | **No** — session only |
| **Plan** | Everything **Ask** + `create_plan`, `update_plan_todo` | `.pyrola/plans/<name-timestamp>/PLAN.md` |
| **Studio** | Everything **Ask** + **Plan** + `write_studio_artifact`, Comark preview, report MCPs | Plans **and** `.pyrola/studio/<slug>/` |
| **Agent** | Full harness (fs write, shell, sub-agents, etc.) | Project files (gated) + chat under `~/.pyrola/chats/` |

**Ask** is Plan/Studio without persistence — same exploration tools, no files generated.

Chats live **user-level only**: `~/.pyrola/chats/<project-slug>/<chat-id>/`. No `<repo>/.pyrola/chats`. See [chat-persistence plan](../chat-persistence-2026-07-15-220100/PLAN.md).

## Built-in tools

| Tool | Backend |
|------|---------|
| read_file, write_file, list_dir | Tauri fs + mtime check |
| grep | ripgrep spawn |
| run_terminal | PTY → bottom `TerminalPanel` |
| git_status, git_diff, git_log, git_branch | git CLI (read-only) |

Git is **informational only** — no `git_commit`/`git_push` tools. User may ask agent to commit via `run_terminal`. See [git-informational plan](../git-informational-2026-07-15-221700/PLAN.md).

All mutating tools go through `invoke()`. Checkpoint after each completed tool result.

Context budget calculated before each turn — see [context-usage plan](../context-usage-2026-07-15-221100/PLAN.md).

## Tauri commands (this phase)

- `fs` — read, write, list, watch, mtime
- `shell` — spawn_pty, write_pty, resize_pty
- `git` — status, diff, log, current branch (read-only)

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
