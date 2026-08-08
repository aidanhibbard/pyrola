# Security

Pyrola can edit files and run shell commands under your policy. Treat permissions as **best-effort** in alpha, not a hardened sandbox guarantee.

## Permission dial

The dial has three levels:

- **Ask:** prompt before sensitive capabilities (writes, shell, git writes, MCP calls) unless a prior allow record applies.
- **Allowlist:** allow only recorded capabilities; ask or deny the rest per policy.
- **Bypass:** skip approval prompts (powerful; use only on trusted work).

Scopes for remembered decisions include session, workspace, and always where the UI offers them.

## What the agent can do

- Read and write project files when tools and permissions allow.
- Run terminal commands in the project context.
- Call trusted MCP tools.
- Commit or checkout when git write tools and permissions allow.

Do not run Bypass against untrusted prompts or untrusted MCP servers.

## Keys and secrets

- Store provider API keys in the OS keychain through Settings.
- Avoid pasting long-lived secrets into chat text.
- Review MCP server commands before trusting them; stdio servers run local processes.

## Report issues

Follow the repository [SECURITY.md](https://github.com/aidanhibbard/pyrola/blob/main/SECURITY.md). Prefer private GitHub Security Advisories over public issues for vulnerabilities.

## Related

- [Permissions settings](../settings/permissions.md)
- [MCP](./mcp.md)
- [Providers and BYOK](./providers-and-byok.md)
