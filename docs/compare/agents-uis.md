# Compared to other Agents UIs

Pyrola is a local-first, BYOK, open-source Agents UI for the desktop. This page compares that niche to Cursor Agents, VS Code Agents, and Google Antigravity using public product docs.

## Comparison table

| | Cursor Agents | VS Code Agents | Antigravity | Pyrola |
| --- | --- | --- | --- | --- |
| Agents UI | Agents Window and sidepane | Agents window (Preview) and Chat view | Antigravity 2.0 desktop and IDE | Dedicated local Agents desktop |
| Local-first core | Local plus cloud VMs | Local plus Copilot cloud agent | Local-first (cloud on roadmap) | Local-first only |
| BYOK | Via Cursor backend | Strong (cloud and local models) | No BYOK / BYO endpoint | Keys in OS keychain; AI SDK and custom endpoints |
| OSS Agents UI | No | Editor OSS; Agents / Copilot proprietary | App proprietary (SDK Apache) | Yes (MIT) |
| Account for core loop | Cursor account | GitHub optional for BYOK chat / agent | Google AI account | None |
| MCP | Yes | Yes | Yes | Yes (stdio / bearer; OAuth incomplete) |
| Multi-agent | Parallel cloud and subagents | Parallel sessions and host orchestration | Parallel local and async subagents | Sub-agents and Orchestrator mode |
| Projects / fleet | Multi-repo Agents Window | Multi-workspace Agents window | Projects with workspaces | Fleet registry of local projects |

## What Cursor Agents UI is optimized for

Cursor's [Agents Window](https://cursor.com/docs/agent/agents-window) is an agent-first workspace across local, cloud, and remote environments. Cloud Agents add isolated VMs, artifacts, and multi-surface kickoff. BYOK exists but requests still go through Cursor's backend, and teams can incur Cursor token rates on third-party usage. See also [Cloud Agents](https://cursor.com/docs/cloud-agent) and [API keys](https://cursor.com/help/models-and-usage/api-keys).

## What VS Code Agents UI is optimized for

VS Code's [Agents overview](https://code.visualstudio.com/docs/agents/overview) and [Agents window](https://code.visualstudio.com/docs/agents/run/agents-window) keep agents inside the editor you already use. Sessions are first-class. Harnesses can target Local, Copilot, Claude, Codex, or Cloud. BYOK and local models are strong, including paths that work without GitHub sign-in for chat and agent. The Agents UI itself is still VS Code chrome; Copilot cloud features remain GitHub services.

## What Antigravity Agents UI is optimized for

[Antigravity](https://antigravity.google/) positions a local multi-agent command center (Antigravity 2.0) plus an agentic IDE. Artifacts (plans, diffs, browser recordings) and projects are first-class. Models come from Google's offered set and plans. [Plans docs](https://antigravity.google/docs/plans) state there is no bring-your-own-key or bring-your-own-endpoint. See [Agent](https://antigravity.google/docs/agent) and [Artifacts](https://antigravity.google/docs/artifacts).

## What Pyrola is optimized for

- Run an Agents UI without a hosted account for the core loop
- Keep provider keys in the OS keychain (BYOK)
- Inspect and fork an open-source UI and harness (MIT)
- Work across a fleet of local projects with a workbench (editor, terminal, plans, studio)

Pyrola does not ship Cursor-style cloud VMs or Antigravity's hosted model quota. It is alpha local software.

## Related

- [What is Pyrola?](../guide/what-is-pyrola.md)
- [FAQ](../faq.md)
- [Providers and BYOK](../guide/providers-and-byok.md)
