# MCP and LSP

Configure Model Context Protocol servers and language servers.

## MCP

Available under Personal and Project.

- Open Settings and select Personal or Project, then MCP.
- Add a stdio server (command and args) or a remote / bearer server.
- Save so config writes to the matching `.pyrola` MCP file.
- Trust the server before agent tool calls.
- Prefer project MCP for repo-specific servers.

Guide: [MCP](../guide/mcp.md).

## LSP

Available under Personal only.

- Open Settings, Personal, LSP.
- Language servers are always on. Install managed servers from the catalog, or disable individual servers globally.
- Auto-download installs default language support on project open (disable for airgapped machines).
- Config lives in the personal app-data `.pyrola/lsp.json`.

Guide: [Workbench](../guide/workbench.md).

## Related

- [Settings overview](./overview.md)
- [Workbench](../guide/workbench.md)
- [Security](../guide/security.md)
