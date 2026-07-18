---
id: config-providers-2026-07-15-215200
title: Phase 2 — Config & Providers
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn: contracts-2026-07-15-215200
todos:
  - id: config-loader
    content: Load and merge ~/.pyrola + .pyrola settings (project wins)
    status: completed
  - id: settings-ui
    content: "Deferred to settings-ui plan — Personal + Project tabs, full provider/MCP UI"
    status: completed
  - id: provider-registry
    content: Provider registry wrapping @ai-sdk/* packages
    status: completed
  - id: http-proxy
    content: Rust reqwest HTTP proxy for arbitrary provider endpoints (CSP bypass)
    status: completed
  - id: keychain
    content: Tauri keychain commands (get_secret, set_secret, delete_secret)
    status: completed
---

## Summary

Wire BYOK config loader + keychain + HTTP proxy. **Settings UI** is covered in [settings-ui plan](../settings-ui-2026-07-15-221100/PLAN.md).

## Config layout

```text
{appDataDir}/.pyrola/settings.json     # user defaults (Tauri-managed; see below)
{appDataDir}/.pyrola/mcp.json          # optional global MCP
<repo>/.pyrola/settings.json          # project overrides (wins)
<repo>/.pyrola/mcp.json
```

User-level paths resolve via Tauri `app.path().app_data_dir()/.pyrola/` (macOS / Windows / Linux).

**No `settings.local.json`.** Two levels only.

## Example settings.json

```jsonc
{
  "version": 1,
  "agent.defaultModel": "anthropic/claude-sonnet-4",
  "agent.defaultMode": "agent",
  "providers.anthropic.apiKeyRef": "anthropic",
  "fleet.maxConcurrentAgents": 4
}
```

## Provider flow

1. Resolve `apiKeyRef` from merged settings → keychain lookup
2. Build AI SDK provider from registry ([all AI SDK providers](https://ai-sdk.dev/providers/ai-sdk-providers) + [OpenAI-compatible custom](https://ai-sdk.dev/providers/openai-compatible-providers))
3. HTTP calls route through Rust `proxy_provider_request`

See [settings-ui plan](../settings-ui-2026-07-15-221100/PLAN.md) for provider picker, custom provider form, and API key UI.

## Key modules

- `src/composables/use-pyrola-config.ts`
- `src/services/providers/`
- `src-tauri/src/commands/http.rs`
- `src-tauri/src/commands/keychain.rs`

## Definition of done

- Can save API key to keychain via Settings UI
- Can select model and run a test `generateText` call through proxy
- Project `.pyrola/settings.json` overrides user defaults
