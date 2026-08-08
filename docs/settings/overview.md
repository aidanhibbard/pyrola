# Settings overview

Settings split into **Personal** and **Project** tabs.

## Personal sections

General, Appearance, MCP, Providers, Models, LSP, Permissions, Plans, Skills, Agents, Rules.

## Project sections

MCP, LSP, Plans, Studio, Skills, Agents, Rules.

Project values override or extend personal config for the active workspace. Personal-only keys (providers and similar) stay personal.

## Where settings live

- Personal config lives under the Pyrola app-data `.pyrola/` directory.
- Project config lives under `<project>/.pyrola/` (for example `settings.json`, `mcp.json`).
- Provider secrets live in the OS keychain, not in plain settings JSON.

Details: [Data and config](../architecture/data-and-config.md).

## Open Settings

- Open Settings from the app chrome.
- Open Settings from the command palette (Cmd+K).
- Jump to a section from the settings sidebar (Personal or Project).

## Related

- [General and Appearance](./general-and-appearance.md)
- [Providers and Models](./providers-and-models.md)
- [MCP and LSP](./mcp-and-lsp.md)
- [Permissions](./permissions.md)
- [Plans, Studio, Skills, Agents, Rules](./plans-studio-skills-agents-rules.md)
