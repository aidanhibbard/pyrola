---
id: settings-ui-2026-07-15-221100
title: Settings UI — Personal & Project
createdAt: 2026-07-16T05:11:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn:
  - config-providers-2026-07-15-215200
  - contracts-2026-07-15-215200
todos:
  - id: settings-view
    content: SettingsView with Personal + Project tabs (project tab only when .pyrola exists)
    status: pending
  - id: appearance-prefs
    content: Theme + glass/vibrancy toggles persisted in ~/.pyrola/settings.json
    status: pending
  - id: provider-registry
    content: Full AI SDK provider registry + custom OpenAI-compatible providers (user + project scope)
    status: pending
  - id: api-key-ui
    content: API key management via keychain refs with add/edit/test per provider
    status: pending
  - id: mcp-list
    content: MCP server list with live status (connected, error, auth required, stopped)
    status: pending
  - id: mcp-auth
    content: Support all VS Code mcp.json auth types (inputs, env, headers, OAuth)
    status: pending
  - id: mcp-authenticate-btn
    content: Authenticate button for OAuth / missing-input MCP servers
    status: pending
  - id: mcp-refresh
    content: Refresh action — reconnect server, re-fetch tools, refresh OAuth token if expired
    status: pending
  - id: mcp-logout
    content: Log out action — revoke/clear OAuth tokens and inputs from keychain
    status: pending
  - id: mcp-tools-panel
    content: Expandable tools list per server (name, description, input schema)
    status: pending

## Summary

Single **Settings** page covering personal preferences, providers, MCP, and project overrides. Two tabs — **Personal** (always) and **Project** (only when active workspace has `.pyrola/`).

**UI spec (per-control):** [ui-settings-page plan](../ui-settings-page-2026-07-15-231800/PLAN.md) — ASCII mockups, every button, component map, SET-1…SET-9 phases.

## Settings page structure

```text
SettingsView
├── Tabs
│   ├── Personal          # ~/.pyrola/settings.json + ~/.pyrola/mcp.json
│   └── Project           # visible only if <repo>/.pyrola/ exists
│                         # <repo>/.pyrola/settings.json + mcp.json
└── Sections (both tabs)
    ├── Appearance        # theme, glass/vibrancy
    ├── Providers         # AI SDK providers + API keys
    ├── MCP Servers       # list, status, tools, auth, refresh, logout, CRUD
    ├── Agents            # link to .pyrola/agents/ (project tab)
    ├── Rules & Skills    # link/manage (project tab)
    └── Fleet             # maxConcurrentAgents, defaults (personal tab)
```

Project tab shows a banner: *"These settings override personal defaults for this project."*

## Appearance (personal)

Persist in `~/.pyrola/settings.json`:

```jsonc
{
  "appearance.theme": "system",       // light | dark | system
  "appearance.glass": true,           // vibrancy / frosted glass
  "appearance.glassVariant": "dark"   // dark | light
}
```

Wire to existing `ModeToggle`, `VibrancyToggle`, and `use-vibrancy` composable.

## Providers

### Goal

Support **all [AI SDK providers](https://ai-sdk.dev/providers/ai-sdk-providers)** plus **custom OpenAI-compatible** endpoints ([docs](https://ai-sdk.dev/providers/openai-compatible-providers)).

### Provider registry

`src/services/providers/registry.ts` — maps provider id → factory:

| Tier | Examples | Package |
|------|----------|---------|
| First-party | OpenAI, Anthropic, Google, Azure, Bedrock, Groq, Mistral, … | `@ai-sdk/*` |
| OpenAI-compatible | Ollama, LM Studio, OpenRouter, self-hosted | `createOpenAI({ baseURL })` |
| Custom | User-defined name + baseURL + apiKeyRef | stored in settings |

### Settings shape

```jsonc
// ~/.pyrola/settings.json (personal)
{
  "providers.openai.apiKeyRef": "openai",
  "providers.anthropic.apiKeyRef": "anthropic",
  "providers.custom.lmstudio": {
    "type": "openai-compatible",
    "baseURL": "http://localhost:1234/v1",
    "apiKeyRef": "lmstudio",
    "name": "LM Studio"
  },
  "agent.defaultProvider": "anthropic",
  "agent.defaultModel": "anthropic/claude-sonnet-4"
}

// <repo>/.pyrola/settings.json (project — overrides)
{
  "agent.defaultModel": "openai/gpt-4o",
  "providers.custom.company-proxy": {
    "type": "openai-compatible",
    "baseURL": "https://llm.corp.internal/v1",
    "apiKeyRef": "corp-llm"
  }
}
```

### Provider UI (per tab scope)

- **List** installed + available providers (from registry)
- **Add provider** — pick from catalog or "Custom OpenAI-compatible"
- **API key** — password input → save to OS keychain under `apiKeyRef` name
- **Test connection** — `generateText` smoke call via Rust HTTP proxy
- **Default model** picker per scope (personal vs project)
- **Delete** custom provider (first-party providers hide key field only)

Secrets never in JSON — only `apiKeyRef` strings. Keychain holds values.

## MCP servers

Use **VS Code `mcp.json` schema** exactly — merge `~/.pyrola/mcp.json` + `<repo>/.pyrola/mcp.json` (project wins by server name).

### MCP list UI

Per server row (collapsed):

| Column | Content |
|--------|---------|
| Name | Server id from mcp.json |
| Type | stdio / http / sse |
| Status | `connected` · `stopped` · `error` · `auth_required` · `starting` |
| Tools | Count badge when connected (e.g. `12 tools`) |
| Actions | See action menu below |

**Row actions** (icon buttons or `...` menu):

| Action | When shown | Behavior |
|--------|------------|----------|
| **Start / Stop** | Always | Spawn or kill MCP server process |
| **Refresh** | Always | Stop → reconnect → `tools/list` → update tool cache + status. If OAuth token expired, refresh token first |
| **Authenticate** | `auth_required` or unresolved inputs | Run auth flow (OAuth browser, input prompts) |
| **Log out** | Authenticated (OAuth or saved inputs) | Clear tokens + keychain entries for this server; set status `auth_required` |
| **Edit** | Always | Open mcp.json editor for this server entry |
| **Delete** | Always | Confirm → remove from mcp.json + stop process |

**Refresh** is distinct from CRUD — it does not change config; it re-initializes the live connection and re-discovers tools. Use after server code changes, token expiry, or transient errors.

### Tools panel (expand row)

Click server row or **Show tools** chevron to expand:

```text
▾ postgres
  Status: connected · 8 tools                    [Refresh] [Log out] [⋯]
  ├── query          Run a read-only SQL query
  ├── list_tables    List tables in schema
  ├── describe_table Show column definitions
  └── ...
```

Each tool shows:
- **Name** — tool id from MCP `tools/list`
- **Description** — one-line summary
- **Schema** — collapsible JSON Schema for inputs (ai-elements `SchemaDisplay` or shadcn accordion)

Tools list cached in memory per server session; **Refresh** invalidates and re-fetches. Tool count feeds **Context Usage** "MCP & dynamic tools" bucket.

### Auth types to support (match VS Code)

| Auth type | mcp.json mechanism | Pyrola UI |
|-----------|-------------------|-----------|
| **Env secrets** | `env: { "API_KEY": "${input:my-key}" }` | Prompt for input → keychain |
| **HTTP Bearer** | `headers: { "Authorization": "Bearer ${input:token}" }` | Prompt → keychain |
| **inputs array** | `promptString` with `password: true` | Settings form fields |
| **OAuth 2.1** | `oauth: { "clientId": "..." }` on http/sse servers | **Authenticate** → system browser flow |
| **Dynamic OAuth (DCR)** | MCP server advertises auth metadata | Auto-discover + token refresh |
| **Client credentials** | Fallback when DCR unsupported | Stored client id/secret in keychain |
| **envFile** | `"envFile": "${workspaceFolder}/.env"` | Path picker + load |

Implement OAuth in Rust/Tauri: open browser to auth URL, callback on `http://127.0.0.1:<port>`, persist tokens in keychain, refresh on expiry (follow MCP authorization spec).

**Authenticate button** visible when status is `auth_required` or inputs are unresolved.

**Log out** clears keychain entries scoped to `mcp:<server-id>:*` (tokens, input values, client secrets) and stops the server. User must re-authenticate to reconnect.

### MCP editor

JSON editor (Monaco) with `$schema` IntelliSense for mcp.json, or structured form for common fields. Validate before save.

## Navigation

- Left sidebar **Settings** button → `/settings`
- Project tab hidden (not disabled) when no `.pyrola/` in active project root
- Deep-link: `/settings?tab=project&section=mcp`

## Key modules

- `src/views/SettingsView.vue`
- `src/components/settings/SettingsPersonalTab.vue`
- `src/components/settings/SettingsProjectTab.vue`
- `src/components/settings/ProviderList.vue`
- `src/components/settings/McpServerList.vue`
- `src/components/settings/McpServerRow.vue`
- `src/components/settings/McpToolsPanel.vue`
- `src/components/settings/AppearanceSection.vue`
- `src/services/mcp/auth/` — oauth, inputs, token refresh, logout
- `src/services/mcp/refresh-server.ts` — reconnect + tools/list
- `src/services/mcp/list-tools.ts`
- `src/services/providers/registry.ts`

## Definition of done

- Personal + Project tabs work; project tab only with `.pyrola/`
- Theme and glass prefs persist and apply immediately
- User can add Anthropic/OpenAI/custom OpenAI-compatible provider with API key
- Project can override provider/model per repo
- MCP list shows live status, tool count, and expandable tools list
- Refresh reconnects and re-lists tools without editing config
- Log out clears auth and returns server to `auth_required`
- Authenticate works for OAuth and missing inputs
- mcp.json edits in Settings match VS Code schema (interop)
