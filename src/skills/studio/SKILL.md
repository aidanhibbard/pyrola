---
name: studio
description: Publish Comark studio artifacts with write_studio_artifact. Use blocks when they help; prose-only is fine. Never use HTML.
---

# Studio artifacts

Publish durable pages to `.pyrola/studio/<slug>/index.md`. Optional `data.json` sidecar for large structured payloads.

## When to use blocks

- **Prose-only** is valid for briefs, summaries, and narrative docs.
- Add blocks when numbers, charts, or tables improve clarity.

## Block catalog

```
::page-header{title="Title" subtitle="Optional"}
::

::metrics
---
items:
  - label: Label
    value: "42"
    delta: "+5%"
    tone: positive
---
::

::chart{type="bar" title="Chart title" xLabel="X" yLabel="Y"}
---
data:
  - label: A
    value: 10
---
::

::table
---
title: Optional table title
columns:
  - key: name
    label: Name
rows:
  - name: Example
---
::

::callout{tone="info" title="Note"}
Body markdown supported inside callouts.
::

::grid{cols="2"}
::
::row
::
::mermaid{code="graph LR; A-->B"}
::
::usage-bar
---
title: Composition
segments:
  - label: A
    value: 60
  - label: B
    value: 40
---
::
```

Reference `data.*` in block props when using a `data.json` sidecar from `write_studio_artifact`.

## Data sources

1. **User** — honor pasted context and @mentions; inline in markdown or `data` param.
2. **Shell** — `run_terminal` when local inspection is needed.
3. **MCP** — `get_mcp_tools` → `call_mcp_tool` → `write_studio_artifact` with optional `data`.

## Quality (visual blocks only)

- Lead with prose: open with context, add short narrative between blocks, close with implications.
- Use blocks to support the story — not as a dashboard dump with no copy.
- Theme tokens only; no gradients, box-shadows, or emoji decoration.
- Charts: title, axis labels with units, source caption when external.
- Prefer a single metrics band over separate cards; keep section spacing generous, padding tight.

## Examples

- `.pyrola/studio/examples/launch-brief/index.md` — prose-only
- `.pyrola/studio/examples/metrics-dashboard/index.md` — blocks + table
- `.pyrola/studio/examples/system-memory/index.md` — ops-style layout
