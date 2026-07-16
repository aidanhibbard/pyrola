---
id: git-informational-2026-07-15-221700
title: Git — Informational Only
createdAt: 2026-07-16T05:17:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn:
  - agent-harness-2026-07-15-215200
  - ide-shell-2026-07-15-215200
todos:
  - id: git-read-tools
    content: Read-only git tools only (status, diff, log, branch) — no git_commit/git_push tools
    status: pending
  - id: changes-panel
    content: Changes workbench tab — informational status + per-turn file summaries, no commit UI
    status: pending
  - id: branch-context-bar
    content: Show current branch in chat context bar (display only)
    status: pending
  - id: no-coauthor
    content: Never add Co-authored-by or co-contributor metadata to commits
    status: pending
---

## Summary

Pyrola's git integration is **purely informational** — help the user see state, not manage git on their behalf. We do not co-author commits, advertise co-contribution, or intrude on the user's git workflow.

## Principles

| Do | Don't |
|----|-------|
| Show current branch in context bar | Auto-commit after agent edits |
| Show `git status` in Changes tab | `Co-authored-by: Pyrola` trailers |
| Show per-turn file diffs (`+30 -5`) | Push, force-push, or branch management tools |
| Show `git diff` in Monaco (read-only) | First-class `git_commit` / `git_push` agent tools |
| Let agent **read** git state in Ask/Agent modes | Market Pyrola as a git co-contributor |

**User-directed commits are fine:** if the user explicitly asks the agent to commit (e.g. "commit these changes"), the agent may run `git commit` via `run_terminal` — that is the user's instruction, not Pyrola intruding. We still never add co-author metadata.

## Built-in git tools (read-only)

| Tool | Purpose | Modes |
|------|---------|-------|
| `git_status` | Working tree summary for Changes tab | Ask, Plan, Studio, Agent |
| `git_diff` | Unified diff for a file or range (display) | Ask, Plan, Studio, Agent |
| `git_log` | Recent commits (context for agent) | Ask, Plan, Studio, Agent |
| `git_branch` | Current branch name for context bar | Ask, Plan, Studio, Agent |

**Not in tool registry:** `git_commit`, `git_add`, `git_push`, `git_checkout`, `git_merge`, `git_rebase`.

## UI surfaces

### Context bar

Display only: `user > main > This Mac` — branch from `git_branch`, no click-to-checkout in v1.

### Changes workbench tab

- File list with staged/unstaged/untracked badges
- Per-agent-turn change summary (filename + line counts via ai-elements `CommitFileChanges` — **display component only**, not a commit action)
- Click file → Monaco diff view (read-only)
- **No** "Commit" button, **no** staging UI, **no** Pyrola branding on git actions

### Agent file edits

Agent writes files via gated `write_file` (shadow diff → approve). Git sees unstaged changes; user commits when they choose — in terminal, VS Code, or by explicitly asking the agent to run git commands.

## Harness policy

```ts
// Default system prompt inclusion (Agent mode)
// "Do not commit, push, or stage changes unless the user explicitly asks.
//  Never add Co-authored-by or similar trailers to commits."
```

`run_terminal` can execute `git commit` only when the user's message clearly requests it — not proactively after completing a task.

## Tauri commands

- `git_status { projectRoot }`
- `git_diff { projectRoot, path?, staged? }`
- `git_log { projectRoot, limit? }`
- `git_current_branch { projectRoot }`

Shell out to system `git` CLI read-only subcommands. No git write operations in dedicated commands.

## Definition of done

- Changes tab and context bar show git state without commit/push affordances
- No `git_commit` tool in harness registry
- Agent does not auto-commit after edits
- No co-author metadata in any commit flow
- User can still say "commit this" and agent uses terminal if they want
