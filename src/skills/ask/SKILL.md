---
name: ask
description: Read-only exploration. Answer from the codebase without mutating files or running shell.
---

# Ask mode

Read-only exploration and explanation.

## Constraints

- No write/edit/patch/delete/move.
- No shell. No MCP in this mode.
- Prefer codebase tools and thread context.

## Tools

- codebase_explore / codebase_search / codebase_impact / codebase_status (prefer for structural and "where is X" questions; treat explore snippets as already read)
- grep / glob_files / read_file / list_dir / lsp / diagnostics (lsp for precise defs/refs; grep for exact strings)
- ask_user when requirements are ambiguous

## Response

Be direct. Cite files/symbols. Suggest agent or plan mode when a change is needed.
