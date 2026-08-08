# What is Pyrola?

**Pyrola is a local-first, bring-your-own-key (BYOK), open-source Agents UI for the desktop.**

It is a Vue and Tauri desktop app with a streaming agent harness. Agents can use tools, spawn sub-agents, and call MCP servers. Provider keys live in the OS keychain. Chats, fleet projects, and settings stay on your machine. There is no cloud account for the core agent loop.

## Who it is for

- Developers who want an Agents UI without a hosted agent product account
- People who already pay providers directly and want BYOK at the reasoning model
- Users who want fleet-style multi-project chats plus a workbench (editor, terminal, plans, studio) in one local app

## Alpha status

Pyrola is alpha. The core loop works: streaming chats, modes, tools, MCP, fleet, and workbench. Expect breaking changes. Permissions and approvals are best-effort. Read [Security](./security.md) before trusting the agent on important repositories.

## Niche in one sentence

Local-first Agents desktop plus true BYOK (keys in the OS keychain) plus open-source UI and harness plus fleet and workbench.

See [Compared to other Agents UIs](../compare/agents-uis.md) for a factual table against Cursor Agents, VS Code Agents, and Antigravity.

## Where data lives

- **App data:** platform app-data directory for `app.pyrola`, under a `.pyrola/` folder (fleet registry, chats, personal settings, LSP caches).
- **Per project:** `<project>/.pyrola/` for project settings, MCP, plans, studio artifacts, skills, agents, and rules.

Details: [Data and config](../architecture/data-and-config.md).

## Next steps

- [Install](./install.md)
- [Getting started](./getting-started.md)
- [Agents UI](./agents-ui.md)
