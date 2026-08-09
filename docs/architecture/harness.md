# Harness

The agent harness lives under `src/services/harness/`. It runs a local `streamText` tool loop with mode allowlists.

## What the harness does

- Stream model output into the chat thread.
- Filter tools by mode (Ask, Plan, Studio, Agent, Orchestrator).
- Execute first-party tools (files, git, terminal, LSP, plans, studio, ask_user, load_skill, spawn_subagent).
- Call MCP tools, list resources, and get prompts when the mode allows.
- Pause for approvals and user questions, then resume.

## Mode allowlists

Modes are not just prompts. They change which tools exist for that turn. See [Modes](../guide/modes.md) for the product view. Implementation: `src/services/harness/mode-allowlists.ts` and `tool-catalog.ts`.

## Sub-agents

- Spawn sub-agents from Agent or Orchestrator when parallel work helps.
- Open a sub-agent thread from the main chat route to inspect nested work.
- Abort or wait on sub-agents through harness registry plumbing.

## File checkpoints

Approved mutate tools (`write_file`, `edit_file`, `apply_patch`, `delete_file`, `move_file`) capture a first-touch baseline under the chat’s `file-checkpoints/` directory before writing disk. Baselines are keyed by the user message that started the turn.

- **Turn files-changed** aggregates tool diffs for review and optional Restore.
- **Edit submit** and **Retry** ask Keep files vs Revert files when later agent mutations exist. Canceling the edit banner never touches disk.
- Restore uses checkpoint blobs, not the chat diff UI. A failed restore blocks chat truncate.
- Shell / terminal side effects are **not** checkpointed. Git remains the source of truth for permanent history.
- Manual edits on agent-touched paths are overwritten on revert (warned in the dialog).
- Forking a chat copies `file-checkpoints/` so Restore still works on the fork.

## Related

- [Architecture overview](./overview.md)
- [Modes](../guide/modes.md)
- [MCP](../guide/mcp.md)
- [Security](../guide/security.md)
