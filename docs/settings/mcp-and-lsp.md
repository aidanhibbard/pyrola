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

Available under Personal and Project.

- Open Settings, Personal or Project, LSP.
- Review managed language servers the app can install (TypeScript, Vue, JSON, YAML, Markdown, and others).
- Allow installs for languages you need in the Monaco editor and harness `lsp` / `diagnostics` tools.
- Prefer project LSP overrides when a workspace needs different servers.

## Related

- [Settings overview](./overview.md)
- [Workbench](../guide/workbench.md)
- [Security](../guide/security.md)
