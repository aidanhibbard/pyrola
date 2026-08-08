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

## Related

- [Architecture overview](./overview.md)
- [Modes](../guide/modes.md)
- [MCP](../guide/mcp.md)
- [Security](../guide/security.md)
