# Permissions

Control how aggressively the harness asks before sensitive tools run.

## Open Permissions

- Open Settings, Personal, Permissions.
- Set the permission dial to Ask, Allowlist, or Bypass.
- Review recorded allow / deny capabilities when using Allowlist.
- Prefer Ask on machines with important repositories until you trust the workflow.

## Dial levels

- **Ask:** show approval cards for sensitive capabilities unless already allowed.
- **Allowlist:** only recorded capabilities proceed without prompts.
- **Bypass:** skip approval prompts for file writes, deletes, and git writes only (alpha power tool; use carefully). Shell and MCP still prompt.

Capabilities include filesystem writes and deletes, shell, unsandboxed shell, git writes, and MCP calls.

## Related

- [Security](../guide/security.md)
- [Settings overview](./overview.md)
- [Agents UI](../guide/agents-ui.md)
