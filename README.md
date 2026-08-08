# pyrola

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](./docs/guide/what-is-pyrola.md)

## Sponsored by

<p align="center">
  <a href="https://getminds.ai/" target="_blank" rel="noreferrer">
    <img src="https://getminds.ai/images/logo.png" alt="Minds" height="72" />
  </a>
</p>

<p align="center">
  <a href="https://getminds.ai/">Minds</a>
</p>

---

**Pyrola is a local-first, bring-your-own-key (BYOK), open-source Agents UI for the desktop.** It runs as a Vue and Tauri app with a streaming agent harness, tools, sub-agents, and MCP. Chats and settings stay on your machine. Provider keys live in the OS keychain. There is no cloud account for the core agent loop.

## Alpha

Pyrola is usable alpha software. Expect rough edges and breaking changes. Agent permissions and approvals are best-effort, not a hardened sandbox. Read [Security](./docs/guide/security.md) before giving an agent shell or write access on important repos.

## Docs

- [Install](./docs/guide/install.md)
- [Getting started](./docs/guide/getting-started.md)
- [How it works](./docs/architecture/overview.md)
- [Compared to other Agents UIs](./docs/compare/agents-uis.md)

Quick local run after install deps: `npm run tauri dev`. Full steps live in the install guide.

## Compared to other Agents UIs

| | Cursor Agents | VS Code Agents | Antigravity | Pyrola |
| --- | --- | --- | --- | --- |
| Agents UI | Agents Window and sidepane | Agents window (Preview) and Chat view | Antigravity 2.0 desktop and IDE | Dedicated local Agents desktop |
| Local-first core | Local plus cloud VMs | Local plus Copilot cloud agent | Local-first (cloud on roadmap) | Local-first only |
| BYOK | Via Cursor backend | Strong (cloud and local models) | No BYOK / BYO endpoint | Keys in OS keychain; AI SDK and custom endpoints |
| OSS Agents UI | No | Editor OSS; Agents / Copilot proprietary | App proprietary (SDK Apache) | Yes (MIT) |
| Account for core loop | Cursor account | GitHub optional for BYOK chat / agent | Google AI account | None |

Sources: [Cursor Agents Window](https://cursor.com/docs/agent/agents-window), [VS Code Agents overview](https://code.visualstudio.com/docs/agents/overview), [Antigravity Plans](https://antigravity.google/docs/plans), [Antigravity agent](https://antigravity.google/docs/agent).

Longer write-up: [Compared to other Agents UIs](./docs/compare/agents-uis.md).

## Features

- **Fleet of projects:** register directories, switch active project, keep chats per project.
- **Modes:** Ask, Plan, Studio, Agent, Orchestrator with mode tool allowlists.
- **Workbench:** Editor, Terminal, Changes, Plan, and Studio tabs beside the agent thread.
- **BYOK providers:** Vercel AI SDK catalog plus custom OpenAI-compatible endpoints.
- **MCP:** stdio and bearer-style servers; tools, resources, and prompts from the harness.
- **Permissions dial:** ask, allowlist, or bypass (best-effort in alpha).

### Chats

![Chats](media/chats.png)

### Providers

![Add provider](media/providers.png)

### Editor

![Editor](media/editor.png)

### Terminal

![Terminal](media/terminal.png)

Full UI tour: [Agents UI](./docs/guide/agents-ui.md).

## License

MIT. See [CONTRIBUTING.md](./CONTRIBUTING.md) if you want to help.
