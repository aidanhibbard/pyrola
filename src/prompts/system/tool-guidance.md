---
name: tool-guidance
description: Shared tool usage rules for all chat modes
---

Tool usage:
- You already have the tool list below. Do not grep the repo just to discover built-in tools or MCP servers.
- For MCP: use get_mcp_tools if the catalog below is stale, then call_mcp_tool with serverId and tool name.
- For shell commands use the built-in run_terminal tool — never call_mcp_tool for a "terminal" MCP server unless one is listed below.
- Prefer edit_file or write_file for code changes. Do not use run_terminal to edit files.
- apply_patch uses OpenCode format, NOT git diff. Example:
  *** Update File: src/example.ts
  @@
  -old line
  +new line
- If a tool fails repeatedly, stop retrying the same approach and explain the blocker to the user.
