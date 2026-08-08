# Agents UI

Pyrola is an Agents UI first. The center of the app is the agent thread. Projects, chats, and the workbench wrap that thread.

## Layout

- **Left sidebar:** fleet projects, chats, and navigation.
- **Center:** home prompt, chat thread, or Settings.
- **Right workbench:** Editor, Terminal, Changes, Plan, and Studio tabs (collapsible).
- **Command palette:** Cmd+K for New Agent, Settings, Terminal, Editor, projects, and chats.

## Chats

Streaming threads show assistant text, tool runs, approvals, questions, and context usage. Modes (Ask, Plan, Studio, Agent, Orchestrator) change which tools the harness may call.

![Chats](/media/chats.png)

## Providers

Add AI SDK providers or a custom OpenAI-compatible endpoint. Keys are stored in the OS keychain, not in a hosted account.

![Providers](/media/providers.png)

## Editor and terminal

The workbench Monaco editor opens project files with multi-file tabs, dirty state, and save. The terminal runs a project PTY; agents can also run shell tools against the same workspace.

![Editor](/media/editor.png)

![Terminal](/media/terminal.png)

## Approvals and permissions

When the permission dial is Ask (or allowlist misses a capability), the thread shows approval cards before sensitive tools run. MCP servers can require trust before tools are available.

Details: [Security](./security.md) and [Permissions](../settings/permissions.md).

## Related

- [Modes](./modes.md)
- [Fleet and projects](./fleet-and-projects.md)
- [Workbench](./workbench.md)
- [Getting started](./getting-started.md)
