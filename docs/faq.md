# FAQ

## What is Pyrola?

Pyrola is a local-first, bring-your-own-key (BYOK), open-source Agents UI for the desktop. It combines a streaming agent harness, tools, sub-agents, MCP, a fleet of projects, and a workbench in a Vue and Tauri app. See [What is Pyrola?](./guide/what-is-pyrola.md).

## Is Pyrola local-first?

Yes. Chats, fleet projects, and settings persist on your machine under the app-data `.pyrola/` tree and optional project `.pyrola/` directories. There is no cloud sync of chats or settings, and no cloud account for the core agent loop. See [Data and config](./architecture/data-and-config.md).

## What does BYOK mean in Pyrola?

Bring your own key. You configure AI SDK providers or custom OpenAI-compatible endpoints and store API keys in the OS keychain. Pyrola does not require a Pyrola-hosted model subscription for the core loop. See [Providers and BYOK](./guide/providers-and-byok.md).

## How does Pyrola compare to Cursor Agents UI?

Cursor's Agents Window is strong at multi-environment and cloud agent workflows. Pyrola focuses on a local-only Agents desktop with open-source UI/harness and keychain BYOK. Cursor BYOK still routes through Cursor. See [Compared to other Agents UIs](./compare/agents-uis.md).

## How does Pyrola compare to VS Code Agents UI?

VS Code Agents stay inside VS Code and offer strong BYOK and multiple harnesses. Pyrola is a dedicated Agents desktop (not an editor extension) with its own fleet and workbench. VS Code's editor is open source; Copilot cloud pieces are proprietary GitHub services. See [Compared to other Agents UIs](./compare/agents-uis.md).

## How does Pyrola compare to Antigravity?

Antigravity is a local multi-agent product with strong artifacts, but it does not support BYOK or BYO endpoints. Pyrola is local-first with keychain BYOK and an MIT-licensed app. See [Compared to other Agents UIs](./compare/agents-uis.md) and Antigravity [Plans](https://antigravity.google/docs/plans).

## Is Pyrola ready for daily use?

It is alpha. The core loop works for tinkering and serious local experiments. Permissions are best-effort. Expect breaking changes. Read [Security](./guide/security.md) before Bypass mode or untrusted MCP servers.

## Where is my data stored?

Fleet, chats, and personal settings live in the platform app-data directory for `app.pyrola` under `.pyrola/`. Project plans, studio artifacts, MCP, and related files live under `<project>/.pyrola/`. Secrets use the OS keychain. See [Data and config](./architecture/data-and-config.md).

## How do I install Pyrola?

Clone the repo, install Node dependencies, and run `npm run tauri dev`. Full steps: [Install](./guide/install.md). First chat: [Getting started](./guide/getting-started.md).

## Does Pyrola support MCP?

Yes for stdio and bearer-style servers, including tools, resources, and prompts from the harness. Full MCP OAuth is not complete in alpha. See [MCP](./guide/mcp.md).
