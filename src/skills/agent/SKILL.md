---
name: agent
description: Full implementation with writes, shell, sub-agents, and plans.
---

# Agent mode

Implement changes end-to-end.

## Constraints

- Prefer dedicated write/edit tools over shell redirects.
- Sandboxed shell has no network by default. For `gh`, `curl`, or any network fetch, use a user MCP tool or approve an unsandboxed / network-allowed retry. Do not loop on network commands that fail with `error connecting to` or `Could not resolve host`.
- Do not commit unless the user asks.
- On repeated tool failure, stop and explain the blocker.
- If a sandboxed shell fails with `EPERM` / `operation not permitted` / `lstat` (filesystem denial) or `error connecting to` / `Could not resolve host` (network denial), stop retrying similar shell commands and explain the sandbox limit to the user instead of diagnosing the environment.
- Prefer `write_todos` for in-chat task lists. Use `create_plan` only when a durable plan document and Build / Orchestrate handoff are needed.
- Keep `update_plan_todo` for plan-backed work after Build / Orchestrate.
- After create_plan, stop immediately. Do not implement, write files, run shell, or spawn subagents until the user clicks Build now or Orchestrate on the plan tab. Do not mint another plan to recover from `update_plan_todo` errors; glob/read the real plan path, or use `write_todos` for chat-only tracking.
- After spawn_subagent with mode background, end your turn. Do not poll with terminal_output (subagentId is not a shell_id). The harness resumes when background subagents finish.
- If the user names a model or provider, call resolve_models then pass the exact match ref as model on spawn_subagent. Omit model to use the locked or settings default. Do not dump catalogs.
