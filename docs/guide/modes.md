# Modes

Each chat has a mode. The harness filters tools with a per-mode allowlist.

## Ask

Use Ask for read-only exploration.

- Read files, search, list directories, and inspect git.
- Use LSP and diagnostics.
- Load skills and ask the user questions.
- Do not write files, run shell, or call MCP in this mode.

## Plan

Use Plan to produce a plan document before implementation.

- Keep Ask read tools.
- Create and update plan todos under `.pyrola/plans/`.
- Stop for Build or Orchestrate after a plan is ready.

## Studio

Use Studio for structured Comark artifacts.

- Keep Plan tools.
- Write studio artifacts under `.pyrola/studio/`.
- Call MCP tools, list resources, and get prompts when needed.

## Agent

Use Agent for implementation work.

- Read and write files (including edit, patch, delete, move).
- Run git writes (checkout, branch create, commit) when permitted.
- Run terminal tools (`run_terminal`, `terminal_output`, `stop_terminal`).
- Call MCP, create plans, write studio artifacts, and spawn sub-agents.

## Orchestrator

Use Orchestrator to coordinate work across sub-agents.

- Read and inspect the workspace (files, git, LSP, diagnostics).
- Create and update plans.
- Call MCP tools, resources, and prompts.
- Spawn sub-agents for parallel investigation or delegated work.
- Do not use direct file-write or terminal tools in Orchestrator; delegate mutation through sub-agents or switch to Agent.

## Pick a mode

- Choose Ask when you want answers without edits.
- Choose Plan when you want a reviewed plan before Build.
- Choose Studio when the output is a structured document artifact.
- Choose Agent when the agent should edit the repo and run commands.
- Choose Orchestrator when you want multi-agent coordination over a plan or investigation.

Related: [Plans and Studio](./plans-and-studio.md), [Harness](../architecture/harness.md).
