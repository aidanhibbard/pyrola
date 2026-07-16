---
id: mcp-studio-2026-07-15-215200
title: Phase 5 — MCP & Studio
createdAt: 2026-07-16T04:52:00Z
mode: plan
parent: pyrola-master-plan-2026-07-15-215200
dependsOn:
  - agent-harness-2026-07-15-215200
  - config-providers-2026-07-15-215200
todos:
  - id: mcp-client
    content: MCP stdio client in Rust (spawn_mcp_server, send_mcp_message)
    status: pending
  - id: mcp-tool
    content: call_mcp_tool in harness with per-agent allowlist
    status: pending
  - id: mcp-lifecycle
    content: MCP lifecycle commands — start, stop, refresh, list_tools, logout
    status: pending
  - id: comark-vue
    content: Install @comark/vue + use-studio-renderer composable
    status: pending
  - id: studio-mdc
    content: Studio MDC blocks (Chart, Metrics, Mermaid) under src/components/studio/mdc/
    status: pending
  - id: studio-artifacts
    content: write_studio_artifact tool → .pyrola/studio/<slug>/index.md
    status: pending
  - id: pdf-v1
    content: PDF export v1 — print CSS, rasterize charts/mermaid, window.print()
    status: pending
---

## Summary

MCP integration (VS Code mcp.json schema) and Studio mode with Comark renderer + PDF export.

## Chat mode capabilities

| Mode | Includes | Disk output |
|------|----------|-------------|
| **Ask** | Read-only exploration | None |
| **Plan** | Ask + plan tools | `PLAN.md` |
| **Studio** | Ask + Plan + studio tools | `PLAN.md` + `.pyrola/studio/<slug>/` |
| **Agent** | Full mutating harness | Project files (gated) |

Studio is a **superset** of Ask and Plan — use it when you want exploration, optional planning, and rich report artifacts in one session.

## MCP

Detailed transport, auth, and lifecycle spec: [mcp-client plan](../mcp-client-2026-07-15-232000/PLAN.md).

- Parse `.pyrola/mcp.json` (VS Code schema; existing stub has shadcn + ai-elements servers)
- Merge user + project configs (project wins by server name)
- Expose as `call_mcp_tool(server, tool, args)`

### MCP client lifecycle (Rust + TS)

| Command | Purpose |
|---------|---------|
| `mcp_start` | Spawn stdio / connect http+sse server |
| `mcp_stop` | Kill process / disconnect |
| `mcp_refresh` | Stop → start → `initialize` → `tools/list` → return fresh tool schemas |
| `mcp_list_tools` | Return cached or live tool list for a server |
| `mcp_logout` | Clear keychain tokens for server id; disconnect |

Settings UI wires these to Refresh / Log out / Show tools. See [settings-ui plan](../settings-ui-2026-07-15-221100/PLAN.md) and [mcp-client plan](../mcp-client-2026-07-15-232000/PLAN.md).

## Studio renderer — Comark (`@comark/vue`)

Successor to deprecated `@nuxtjs/mdc`. Same `::component` syntax, Vue 3 native, streaming-friendly.

```text
.pyrola/studio/yelp-pilot-update/
  index.md
  data.json          # optional MCP-fetched data
src/components/studio/mdc/
  Chart.vue            # ::chart
  Metrics.vue          # ::metrics
  Mermaid.vue          # ::mermaid
```

Live preview in workbench Studio tab; agent streams markdown incrementally.

## PDF export

| Version | Approach |
|---------|----------|
| v1 | Print CSS + rasterize charts → `window.print()` → Save as PDF |
| v1.5 | `@comark/html` static snapshot → export.html |
| v2 | Platform-native `export_studio_pdf` Rust command (WebView2 / WKWebView) |

**Avoid:** html2pdf.js, separate PDF templates.

## Definition of done

- Postgres MCP (or similar) can drive a Studio report
- Comark renders metrics grid + bar chart like Cursor Canvas screenshots
- Export PDF via print dialog produces readable output
