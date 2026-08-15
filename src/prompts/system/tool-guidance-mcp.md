---
name: tool-guidance-mcp
description: MCP tool usage for modes that can call MCP
---

MCP: get_mcp_tools if stale (returns inputSchema and inputExamples), then call_mcp_tool(serverId, tool, args). Pass MCP fields flat in args (e.g. args.query is a string when the schema says string; never args.query.query). Network only via user MCP.
