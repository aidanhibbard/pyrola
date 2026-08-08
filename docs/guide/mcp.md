# MCP

Pyrola connects to Model Context Protocol servers and exposes their tools, resources, and prompts to the harness.

## What works in alpha

- Add stdio MCP servers (command + args).
- Add HTTP / bearer-style remote servers where configured.
- Trust a server before the agent can call its tools.
- Call MCP tools via `call_mcp_tool` / `get_mcp_tools` in Agent, Studio, and Orchestrator modes.
- List and read MCP resources, and get MCP prompts, when the server supports them.

Full OAuth 2.1 for MCP is not complete yet. Prefer stdio or bearer setups for alpha.

## Add and trust a server

- Open Settings and choose Personal or Project MCP (project overrides apply to that workspace).
- Add a server with transport details (stdio command or remote URL).
- Save the MCP config under the matching `.pyrola` scope.
- Trust the server when prompted so the harness may call its tools.
- Start an Agent (or Studio / Orchestrator) chat and ask the model to use an MCP tool you configured.

## Project vs personal MCP

- Configure personal MCP for servers you want across projects.
- Configure project MCP under `<project>/.pyrola/` for repo-specific servers.
- Prefer project scope when a server should not follow you into other repos.

Details: [MCP and LSP](../settings/mcp-and-lsp.md).

## Related

- [Modes](./modes.md)
- [Security](./security.md)
- [Settings overview](../settings/overview.md)
