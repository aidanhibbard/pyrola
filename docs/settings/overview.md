# Settings overview

Settings are global (app-wide). Project-scoped config lives on the Project view.

## Settings sections

General, MCP, Providers, Models, LSP, Permissions, Plans, Skills, Agents, Rules.

## Project view

Open a project from the left sidebar context menu (Open Project). Sections: Chats, MCP, Plans, Studio, Skills, Agents, Rules.

Project values override or extend personal config for that workspace. Personal-only keys (providers, models, LSP, and similar) stay in Settings.

## Where settings live

- Personal config lives under the Pyrola app-data `.pyrola/` directory (including `lsp.json`).
- Project config lives under `<project>/.pyrola/` (for example `settings.json`, `mcp.json`).
- Provider secrets live in the OS keychain, not in plain settings JSON.

Details: [Data and config](../architecture/data-and-config.md).

## Open Settings

- Open Settings from the app chrome.
- Open Settings from the command palette (Cmd+K).
- Jump to a section from the settings sidebar.

## Related

- [General and Appearance](./general-and-appearance.md)
- [Providers and Models](./providers-and-models.md)
- [MCP and LSP](./mcp-and-lsp.md)
- [Permissions](./permissions.md)
- [Plans, Studio, Skills, Agents, Rules](./plans-studio-skills-agents-rules.md)
- [Fleet and projects](../guide/fleet-and-projects.md)
