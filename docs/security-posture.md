# Security posture

Honest summary of what Pyrola enforces today, what it does not, and how that compares to [OpenCode](https://opencode.ai/). This is an audit note, not a compliance claim.

## Scope

Pyrola is a local-first Agents UI (Vue + Tauri). The agent can edit project files and run shell commands under user policy. Treat the stack as **best-effort** in alpha: useful controls exist, but they are not a hardened multi-tenant sandbox.

## Sandbox approach

When `agent.sandbox.enabled` is true (product default), agent shell spawns request OS sandboxing:

| Platform | Mechanism | Notes |
| --- | --- | --- |
| macOS | Seatbelt via `sandbox-exec` | Generated profile: deny-by-default, project root RW, limited HOME caches, deny `.ssh` / `.aws` / `.gnupg`, deny `.git/hooks` writes, optional network |
| Linux | bubblewrap (`bwrap`) | Namespace isolation when `bwrap` is installed; otherwise sandboxed spawn fails and the harness can ask to retry unsandboxed |
| Other | No OS sandbox | Sandboxed spawn is refused; unsandboxed only after explicit approval |

Defaults at the Rust spawn boundary prefer sandboxed (`sandboxed` unset means sandboxed). Network in the profile defaults to deny (`agent.sandbox.network`).

**Limitations:** Seatbelt / bwrap constrain the agent shell tool path. They do not sandbox MCP stdio processes, LSP servers, or the Tauri app itself. They are not a VM. Escape and misconfiguration remain possible; report sandbox escapes via [SECURITY.md](https://github.com/aidanhibbard/pyrola/blob/main/SECURITY.md).

## Permission model

Three dial levels (Ask, Allowlist, Bypass) plus an approval gate:

- **Ask:** prompt for sensitive tools unless already allowed for the session / persisted record.
- **Allowlist:** recorded capabilities and auto-approve globs; otherwise ask.
- **Bypass:** auto-allows **file writes, deletes, and git writes only**. Shell and MCP still go through the approval gate.

Shell approvals intentionally omit workspace / always scopes (once / session / never only). Sensitive path heuristics force ask even when Bypass or a prior allow would otherwise apply.

Real controls that stay: dial + gate, sensitive-path ask, sandboxed vs unsandboxed shell capabilities, MCP trust fingerprints, keychain-backed secrets.

## Secrets handling

Provider API keys and MCP secrets are stored via the OS keychain through Tauri commands. Avoid pasting long-lived secrets into chat. MCP elicitation UI warns that servers may phish for secrets.

## MCP trust model

- User MCP servers must be trusted (session or persisted workspace / always fingerprint) before harness tools can call them.
- Stdio spawn is limited to PATH basenames on a Rust allowlist (`npx`, `uvx`, `node`, and similar). Absolute paths are rejected.
- Allowlisted launchers can still run arbitrary packages; trust the server config and package, not only the basename.
- First-party CodeGraph is product-owned and skips the user MCP trust card path by design.
- Remote MCP OAuth is incomplete in alpha; prefer stdio or bearer setups.

## What was removed vs what stays

Earlier phases removed undocumented agent caps that looked like security but were not real policy (for example silent step / buffer style limits that were not user-facing controls). **Removed caps are not a substitute for permissions.**

What stays as intentional controls:

- Permission dial and approval cards
- OS shell sandboxing when enabled
- MCP trust + spawn allowlist
- Keychain secrets
- Sensitive-path ask behavior

Pyrola does **not** ship built-in browser CDP or WebFetch tools. Network beyond the model provider is via user MCP (or an explicitly allowed sandbox network setting).

## Comparison to OpenCode

| Area | Pyrola | OpenCode |
| --- | --- | --- |
| Permissions | Dial (Ask / Allowlist / Bypass) + capability gate; Bypass is partial | Config rules (`allow` / `ask` / `deny`) per tool, often with pattern objects; defaults are relatively permissive with guards like `.env` deny and `external_directory` / `doom_loop` ask |
| OS sandbox | macOS Seatbelt + Linux bwrap for agent shell (default on when setting is true) | Experimental macOS Seatbelt sandbox (opt-in); Linux/Windows coverage differs; see OpenCode sandbox docs and related PRs |
| Web tools | No first-party WebFetch / browser CDP | Includes `webfetch` / `websearch` permissions |
| MCP | Explicit trust + basename spawn allowlist | MCP is supported; sandbox docs note MCP is outside the bash Seatbelt path (similar gap) |
| Secrets | OS keychain for provider / MCP secrets | Provider keys via `/connect` and local config; model differs by product surface |

Both products separate **permission prompts** from **OS sandboxing**. Neither should be described as a complete isolation boundary around every process the agent can start.

## Gaps and limitations (honest)

1. Bypass UI copy historically over-claimed "skip all checks"; behavior is narrower (writes / git only). Prefer the dial descriptions that match `decidePermission`.
2. Shell session allow for capability `shell` can also satisfy `shell.unsandboxed` checks in policy (shared `sessionAllows.has('shell')` branch). Treat that as a policy footgun until fixed.
3. `prepare-stream` and `run-terminal` use different fallbacks when `agent.sandbox.enabled` is missing (`false` vs `true`). Merged settings normally include the default `true`, but the fallbacks should stay consistent.
4. MCP launchers on the allowlist are powerful; trusting `npx`/`uvx` servers is trusting their packages and env.
5. Alpha: expect policy and UI wording to tighten; do not rely on Pyrola for hostile multi-tenant isolation.

## Related

- [Security guide](./guide/security.md)
- [Permissions settings](./settings/permissions.md)
- [MCP](./guide/mcp.md)
- OpenCode permissions: https://opencode.ai/docs/permissions/
