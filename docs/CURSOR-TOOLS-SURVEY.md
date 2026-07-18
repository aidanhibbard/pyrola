# Cursor Agent Tools Survey — Pyrola Parity

**Updated:** 2026-07-17

This document surveys tools exposed in **Cursor's editor/agent window** and maps each to Pyrola's current harness, Tauri backend, and UI capabilities. Use it to prioritize parity work and to explain intentional divergences.

**Sources reviewed:** `src/services/harness/tool-catalog.ts`, `build-tools.ts`, `mode-allowlists.ts`, `src/services/harness/tools/`, `src-tauri/src/commands/` (`fs`, `git`, `shell`, `lsp`, `mcp`, `grep`, `glob`, `http`), and `docs/STATUS.md`.

**Status legend**

| Status | Meaning |
|--------|---------|
| **Exists** | First-class agent tool or equivalent shipped in Pyrola |
| **Partial** | Related capability exists but incomplete vs Cursor |
| **Gap — implementing** | Tractable gap planned for near-term implementation (none remaining as of Workstream H3) |
| **Gap — future** | Larger or out-of-scope gap for a later phase |

---

## Summary

| Category | Exists | Partial | Gap — implementing | Gap — future |
|----------|--------|---------|-------------------|--------------|
| File operations | 9 | 0 | 0 | 1 |
| Code intelligence | 2 | 0 | 0 | 0 |
| Git | 6 | 2 | 0 | 1 |
| Terminal / shell | 3 | 0 | 0 | 0 |
| Web | 2 | 0 | 0 | 1 |
| Browser automation | 0 | 1 | 0 | 1 |
| Search | 2 | 0 | 0 | 1 |
| MCP | 2 | 1 | 0 | 5 |
| Sub-agents | 4 | 1 | 0 | 3 |
| Plans / todos | 2 | 2 | 0 | 0 |
| Checkpoints | 0 | 1 | 0 | 1 |
| Hooks | 0 | 0 | 0 | 1 |
| Worktrees | 0 | 0 | 0 | 1 |
| Debug mode | 0 | 0 | 0 | 1 |
| Sandbox / auto-review | 0 | 1 | 0 | 1 |
| Image-aware reads | 1 | 0 | 0 | 0 |
| Skills / slash commands | 1 | 1 | 0 | 0 |
| Pyrola-only tools | 4 | — | — | — |

Pyrola ships **31 harness tools** across chat modes (Ask, Plan, Studio, Agent, plus Orchestrator for multi-subagent coordination). Cursor exposes a broader surface (browser MCP, semantic exploration, checkpoints, hooks, worktrees, debug, sandbox classifier, general todos, mode-switch tool, progress steps, MCP resources/prompts, etc.). Tractable parity gaps from Workstream H2 (`delete_file`, `move_file`, git write tools, `diagnostics`, image-aware `read_file`, `web_search`) and the LSP backend (Workstreams I1+I2) are now implemented; larger gaps are tracked in [Future work](#future-work) below.

---

## File operations

| Cursor tool | Description | Pyrola status | Pyrola equivalent |
|-------------|-------------|---------------|-------------------|
| `Read` | Read file with optional `offset` / `limit`; supports images (jpeg, png, gif, webp) | **Exists** | `read_file` — text with offset/limit; image paths return mime metadata and optional base64 via `fs_read_file` |
| `Write` | Create or overwrite a file | **Exists** | `write_file` (approval-gated) |
| `StrReplace` | Exact search/replace edit in a file | **Exists** | `edit_file` |
| `Delete` | Delete a file from the workspace | **Exists** | `delete_file` — approval-gated; uses `fs_stage_preview` + `fs::remove_file` |
| Move / rename | Move or rename a workspace file | **Exists** | `move_file` — approval-gated; Tauri `fs_rename` / `fs_move` |
| `Glob` | Find files by glob pattern | **Exists** | `glob_files` → `workspace_glob` |
| `Grep` | Regex search file contents (ripgrep) | **Exists** | `grep` → `workspace_grep` |
| List directory | List directory entries | **Exists** | `list_dir` → `fs_list_dir` |
| Multi-file patch | Apply structured multi-file edits | **Exists** (Pyrola extension) | `apply_patch` (OpenCode format, not git diff) |
| `EditNotebook` | Edit Jupyter notebook cells | **Gap — future** | No notebook editor or harness tool |

---

## Code intelligence

| Cursor tool | Description | Pyrola status | Pyrola equivalent |
|-------------|-------------|---------------|-------------------|
| `ReadLints` | Read linter / diagnostic errors for files or paths | **Exists** | `diagnostics` — LSP-backed via `lsp_ensure_server` + `lsp_request` (`diagnostics` method) |
| Go to definition | Jump to symbol definition | **Exists** | `lsp` tool with `goToDefinition`; Tauri LSP runtime (Workstreams I1+I2) |
| Hover | Type/symbol hover info | **Exists** | `lsp` with `hover` method |
| Find references | Find symbol references | **Exists** | `lsp` with `findReferences` |
| Document symbols | List symbols in a file | **Exists** | `lsp` with `symbols` |

---

## Git

Git in Pyrola was **informational by design** for early v1 (see `.pyrola/plans/git-informational-2026-07-15-221700/PLAN.md`). Workstream H2 added Agent-mode write tools (`git_checkout`, `git_branch_create`, `git_commit`); read-only tools remain available in all modes.

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| `git status` | Working tree status | **Exists** | `git_status` |
| `git diff` | Show unstaged/staged diff | **Exists** | `git_diff` (backend also supports `staged` flag; harness does not expose it) |
| `git log` | Commit history | **Exists** | `git_log` |
| Current branch | Show active branch | **Partial** | `git_branch` → `git_repo_info` (current branch only; does not list branches) |
| List branches | List local branches | **Partial** | Tauri `git_list_branches` exists; harness exposes current branch via `git_branch` only — no dedicated list tool |
| Checkout branch | Switch branches | **Exists** | `git_checkout` → `git_checkout_branch` |
| `git commit` | Stage and commit changes | **Exists** | `git_commit` → Tauri `git_commit` (Agent mode; approval policy TBD) |
| Create branch | Create a new local branch | **Exists** | `git_branch_create` → Tauri `git_branch_create` |
| `git blame` | Line-attribution blame | **Gap — future** | No backend or harness support |
| Changes UI | Visual diff / changes panel | **Partial** (UI only) | Informational Changes workbench tab; not an agent tool |

---

## Terminal / shell

| Cursor tool | Description | Pyrola status | Pyrola equivalent |
|-------------|-------------|---------------|-------------------|
| `Shell` | Run shell command (blocking or background) | **Exists** | `run_terminal` — blocking default; `is_background` for long-running |
| `Await` | Poll background shell until exit or pattern match | **Exists** | `terminal_output` (`block`, `tail`) |
| Stop shell | Kill a background shell | **Exists** | `stop_terminal` |
| Interactive PTY | User-facing terminal tab | **Exists** (UI) | Workbench terminal via `shell_spawn_pty` / `shell_write_pty` — not agent tools |
| Tracked shell registry | Per-chat shell lifecycle | **Exists** | `agent-shell-registry` + `shell_spawn_tracked` / `shell_kill_tracked` |

---

## Web

| Cursor tool | Description | Pyrola status | Pyrola equivalent |
|-------------|-------------|---------------|-------------------|
| `WebFetch` | Fetch URL and return readable content | **Exists** | `web_fetch` → `http_proxy_request` |
| `WebSearch` | Search the web for real-time information | **Exists** | `web_search` — DuckDuckGo Instant Answer API via `http_proxy_request` |
| `GenerateImage` | Generate image from text description | **Gap — future** | No harness tool or image generation service |

---

## Browser automation

| Cursor tool | Description | Pyrola status | Pyrola equivalent |
|-------------|-------------|---------------|-------------------|
| `browser_navigate` | Open URL in agent-controlled browser | **Gap — future** | Workbench **Browser** tab exists (user UI); no agent harness tools |
| `browser_snapshot` | Accessibility snapshot of page | **Gap — future** | — |
| `browser_click` / `browser_type` / etc. | DOM interaction automation | **Gap — future** | — |
| `browser_take_screenshot` | Visual screenshot | **Gap — future** | — |
| `browser_lock` / `browser_unlock` | Session lock for automation | **Gap — future** | — |

Cursor ships browser automation via the **cursor-ide-browser** MCP server. Pyrola could eventually expose similar tools through MCP or a native wrapper.

---

## Semantic / codebase search

| Cursor tool | Description | Pyrola status | Pyrola equivalent |
|-------------|-------------|---------------|-------------------|
| `Grep` (regex) | Fast exact/regex search | **Exists** | `grep` |
| `Glob` | Path pattern search | **Exists** | `glob_files` |
| Semantic / codebase search | Embedding- or index-based "find by meaning" | **Gap — future** | No semantic index or dedicated tool |
| `Task` (explore) | Sub-agent optimized for broad codebase exploration | **Partial** | `spawn_subagent` is read-only drill-down, not a dedicated explore agent type |

---

## MCP (Model Context Protocol)

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| `GetMcpTools` | Discover servers and tool schemas | **Exists** | `get_mcp_tools` — merges personal + project config, calls `mcp_status` |
| `CallMcpTool` | Invoke an MCP tool | **Exists** | `call_mcp_tool` → `mcp_call_tool` |
| `FetchMcpResource` | Read an MCP resource by URI | **Gap — future** | No resource fetch harness tool or Tauri command |
| MCP Resources (list/read/subscribe) | Full resource surface | **Gap — future** | MCP runtime is tools-focused |
| MCP Prompts | Server-defined prompt templates | **Gap — future** | Not implemented |
| MCP Elicitation | Server-driven user input requests | **Gap — future** | Pyrola uses `ask_user` instead (first-party) |
| MCP Apps | MCP app/extension integrations | **Gap — future** | Not implemented |
| `mcp_auth` | Authenticate MCP server (OAuth / inputs) | **Partial** | `mcp_start` sets `auth_required`; full OAuth 2.1 not shipped (`docs/STATUS.md`) |
| MCP server lifecycle | Start / stop / refresh | **Exists** (settings UI + Tauri) | `mcp_start`, `mcp_stop`, `mcp_refresh`, `mcp_logout` — not agent tools |

---

## Sub-agents

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Spawn sub-agent | Delegate a subtask to a child agent | **Exists** | `spawn_subagent` (Agent mode only) |
| Read-only sub-agent toolset | Child limited to safe tools | **Exists** | `SUBAGENT_READ_ONLY_TOOLS` in `build-tools.ts` |
| Nested tool events | Parent sees child tool runs | **Exists** | `subagent-event` harness events |
| Background sub-agent | Non-blocking child (`run_in_background`) | **Exists** | `spawn_subagent` with `blocking: false`; parent turn continues; `resumeOrchestrator` completes the turn when the child finishes (Workstream G) |
| Resumable sub-agent | Resume prior agent by ID | **Partial** | Harness persists turn messages in `subagent-registry` and resumes after background completion; no agent-facing `resume` parameter on `spawn_subagent` |
| Nested sub-agents | Child can spawn its own children | **Gap — future** | Nested ctx excludes `spawn_subagent` |
| Cloud / isolated sub-agent | Separate VM or git worktree per child | **Gap — future** | No cloud agent or worktree isolation |
| Sub-agent type selection | `explore`, `shell`, `generalPurpose`, etc. | **Gap — future** | Single read-only sub-agent profile |

---

## Plans / todos

| Cursor tool | Description | Pyrola status | Pyrola equivalent |
|-------------|-------------|---------------|-------------------|
| `TodoWrite` | Create/update session todo list in chat | **Partial** | Inline todo timeline from `create_plan` / `update_plan_todo`; no general session `TodoWrite` tool |
| `SwitchMode` | Agent switches Ask ↔ Plan ↔ Agent mode | **Partial** | Four modes (Ask, Plan, Studio, Agent) are user-selected in UI; no agent-invoked mode switch |
| `UpdateCurrentStep` | Progress step for parent timeline | **Gap — future** | No harness progress-step tool |
| Create plan document | Structured plan file with todos | **Exists** (Pyrola extension) | `create_plan` |
| Update plan todos | Mutate plan todo items | **Exists** (Pyrola extension) | `update_plan_todo` |
| Plan build handoff | Execute plan in Agent mode | **Exists** (UI flow) | Plan tab Done/Build/Built — not a tool |

---

## Checkpoints

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Conversation checkpoint | Restore agent state mid-turn | **Gap — future** | No rewind/restore checkpoint tool |
| Message persistence | Append-only chat log for resume | **Partial** | `messages.jsonl` append per harness event; resume after relaunch, not mid-turn checkpoint |
| Tool-result checkpoint | Persist after each tool result | **Partial** | Orchestrator persists harness events; not exposed as agent-facing checkpoint API |

---

## Hooks

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Cursor hooks (`hooks.json`) | Automate on agent events (before/after tool, etc.) | **Gap — future** | No hooks engine or configuration surface |

---

## Worktrees

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Agent git worktree | Isolated branch/worktree per agent task | **Gap — future** | Referenced in UI plans only; not implemented |
| `best-of-n-runner` | Parallel attempts in isolated worktrees | **Gap — future** | Not implemented |

---

## Debug mode

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Debug mode | Systematic troubleshooting with runtime evidence | **Gap — future** | No dedicated debug mode or harness variant |

---

## Sandbox / auto-review

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Smart mode / auto-review | Classify and block risky tool calls before execution | **Gap — future** | No command classifier or smart-mode approval card |
| Write approval gate | User approves file mutations | **Partial** | `approval-gate` for `write_file`, `edit_file`, `apply_patch` with glob auto-approve |
| Shadow-path Monaco diff | Inline diff approval in editor | **Gap — future** | Not shipped (`docs/STATUS.md`) |
| Command sandbox | Restrict shell to safe allowlist | **Gap — future** | `run_terminal` runs full user shell |

---

## Image-aware file reading

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Read image files | Return image content to the model from `Read` | **Exists** | `read_file` detects image extensions; `fs_read_file` returns mime metadata and optional base64 |

---

## Slash-command skills

| Cursor capability | Description | Pyrola status | Pyrola equivalent |
|-------------------|-------------|---------------|-------------------|
| Agent skills (`SKILL.md`) | Load specialized instructions by name | **Exists** | `load_skill` → `skill-registry` |
| Mode skill auto-injection | Inject mode skill without tool call | **Exists** | System prompt loads mode skills (`system-prompt-parts.ts`) |
| Slash commands | `/command` triggers in chat | **Partial** | Command palette (Cmd+K); no full slash-command router in agent input |
| Rules / `AGENTS.md` | Project conventions in context | **Partial** | Rules listed in context; glob-scoped injection incomplete (`docs/STATUS.md`) |

---

## User interaction (first-party)

| Pyrola tool | Description | Cursor analogue | Status |
|-------------|-------------|-----------------|--------|
| `ask_user` | Pause agent and ask a clarifying question | MCP elicitation / UI question flows | **Exists** |
| `write_studio_artifact` | Publish Comark studio artifact | Cursor Canvas (different model) | **Exists** (Pyrola-only) |

---

## Pyrola harness tool inventory (by mode)

Full tool registry from `mode-allowlists.ts`:

| Tool | Ask | Plan | Studio | Agent |
|------|-----|------|--------|-------|
| `read_file` | ✓ | ✓ | ✓ | ✓ |
| `write_file` | | | | ✓ |
| `edit_file` | | | | ✓ |
| `apply_patch` | | | | ✓ |
| `delete_file` | | | | ✓ |
| `move_file` | | | | ✓ |
| `grep` | ✓ | ✓ | ✓ | ✓ |
| `glob_files` | ✓ | ✓ | ✓ | ✓ |
| `list_dir` | ✓ | ✓ | ✓ | ✓ |
| `git_status` | ✓ | ✓ | ✓ | ✓ |
| `git_diff` | ✓ | ✓ | ✓ | ✓ |
| `git_log` | ✓ | ✓ | ✓ | ✓ |
| `git_branch` | ✓ | ✓ | ✓ | ✓ |
| `git_checkout` | | | | ✓ |
| `git_branch_create` | | | | ✓ |
| `git_commit` | | | | ✓ |
| `lsp` | ✓ | ✓ | ✓ | ✓ |
| `diagnostics` | ✓ | ✓ | ✓ | ✓ |
| `run_terminal` | ✓ | ✓ | ✓ | ✓ |
| `terminal_output` | ✓ | ✓ | ✓ | ✓ |
| `stop_terminal` | ✓ | ✓ | ✓ | ✓ |
| `web_fetch` | ✓ | ✓ | ✓ | ✓ |
| `web_search` | ✓ | ✓ | ✓ | ✓ |
| `load_skill` | ✓ | ✓ | ✓ | ✓ |
| `ask_user` | ✓ | ✓ | ✓ | ✓ |
| `call_mcp_tool` | ✓ | ✓ | ✓ | ✓ |
| `get_mcp_tools` | ✓ | ✓ | ✓ | ✓ |
| `create_plan` | | ✓ | ✓ | ✓ |
| `update_plan_todo` | | ✓ | ✓ | ✓ |
| `write_studio_artifact` | | | ✓ | ✓ |
| `spawn_subagent` | | | | ✓ |

---

## Tauri backend commands (not all exposed as harness tools)

| Module | Commands | Harness exposure |
|--------|----------|------------------|
| `fs` | `fs_read_file`, `fs_write_file`, `fs_edit_file`, `fs_apply_patch`, `fs_list_dir`, `fs_list_dir_tree`, `fs_stat`, `fs_stage_preview`, `fs_rename`, `fs_move` | Wired (`read_file`, writes, `delete_file`, `move_file`) |
| `git` | `git_status`, `git_diff`, `git_log`, `git_repo_info`, `git_list_branches`, `git_checkout_branch`, `git_branch_create`, `git_commit` | Status/diff/log/branch wired; checkout/create/commit wired in Agent mode |
| `grep` / `glob` | `workspace_grep`, `workspace_glob` | Wired |
| `shell` | `shell_run_command`, `shell_spawn_tracked`, `shell_kill_tracked`, PTY commands | Agent uses tracked spawn via `agent-shell-registry` |
| `lsp` | `lsp_ensure_server`, `lsp_request`, `lsp_status`, `lsp_stop_server` | Wired — spawns language servers from settings (Workstreams I1+I2) |
| `mcp` | `mcp_start`, `mcp_stop`, `mcp_call_tool`, `mcp_status`, … | Tools wired; resources/prompts/auth not |
| `http` | `http_proxy_request`, `http_proxy_stream` | `web_fetch` and `web_search` |
| `chat` | CRUD, pin, fork, truncate | Persistence layer, not agent tools |
| `watch` | `watch_pyrola_paths` | File watcher for UI refresh |

---

## Completed tractable gaps (Workstreams H2, I1, I2, G)

The following items were previously marked **Gap — implementing** and are now shipped:

| Gap | Shipped as | Workstream |
|-----|------------|------------|
| `delete_file` | Approval-gated harness tool | H2 |
| `move_file` | Tauri rename/move + harness tool | H2 |
| `git_checkout` / `git_branch_create` / `git_commit` | Agent-mode git write tools | H2 |
| `diagnostics` | LSP-backed harness tool | H2 + I1/I2 |
| Image-aware `read_file` | Binary/image detection in `fs_read_file` | H2 |
| `web_search` | First-party DuckDuckGo search | H2 |
| LSP backend | Language-server spawn and JSON-RPC in Tauri | I1 + I2 |
| Non-blocking subagents | `spawn_subagent` `blocking: false` + `resumeOrchestrator` | G |

---

## Future work

Larger Cursor parity gaps deferred to later phases. Each item is a concrete future todo with a suggested approach.

### Browser automation harness tools

**What:** Agent-facing tools to navigate, snapshot, click, type, screenshot, and lock a browser session — matching Cursor's `cursor-ide-browser` MCP surface (`browser_navigate`, `browser_snapshot`, `browser_click`, etc.).

**Why deferred:** Pyrola already has a user-facing Browser workbench tab, but agent automation requires a controllable webview/CDP bridge, session lifecycle, and security review for untrusted pages. This is a full subsystem, not a single Tauri command.

**Rough approach:** Either (a) ship a first-party `browser_*` harness tool family backed by a Tauri webview + CDP layer, or (b) bundle/document a Pyrola MCP server that wraps the same primitives Cursor exposes. Start with `navigate` + `snapshot` + `screenshot`; add interaction tools behind an approval gate.

### Semantic / codebase search

**What:** Embedding- or index-based "find by meaning" search beyond regex `grep` and path `glob` — plus a dedicated explore sub-agent type optimized for broad codebase discovery (Cursor's `Task` explore agent).

**Why deferred:** Requires an index pipeline (embeddings, incremental updates on file watch), storage, and ranking — plus harness integration for semantic queries. Regex search is sufficient for v1 agent workflows.

**Rough approach:** Build a workspace indexer (Tauri background job or sidecar) that chunks files and stores vectors locally (SQLite + sqlite-vec or similar). Expose `semantic_search` harness tool and optionally a `subagentType: explore` profile with search-heavy tool allowlist.

### Conversation checkpoints

**What:** Mid-turn rewind/restore — agent or user can roll back to a checkpoint before a tool run or message and continue from there (Cursor checkpoint API).

**Why deferred:** Pyrola persists harness events append-only (`messages.jsonl`) for relaunch resume, but there is no agent-facing checkpoint tool or UI to branch/restore mid-turn state.

**Rough approach:** Snapshot harness state (messages, pending approvals, subagent registry) at tool boundaries; store checkpoint records keyed by chat + turn index. Add `create_checkpoint` / `restore_checkpoint` harness tools or a user "Rewind to here" action in the thread UI wired to truncate + replay orchestrator state.

### Hooks engine (`hooks.json`)

**What:** User-configurable automation on agent lifecycle events — before/after tool calls, on subagent start, on mode change, etc. (Cursor hooks).

**Why deferred:** Needs a hook runner (shell scripts or JS), configuration schema, sandboxing, and clear interaction with the approval gate. No configuration surface exists in Pyrola today.

**Rough approach:** Define a `hooks.json` schema under `.pyrola/` or project root; Tauri spawns hook processes with structured JSON stdin/stdout at orchestrator event points. Start read-only (logging/telemetry hooks) before mutating hooks.

### Agent git worktrees

**What:** Isolated git worktree (or branch) per agent task so parallel agents or best-of-N runs do not stomp the same working tree (Cursor `best-of-n-runner`, cloud agent isolation).

**Why deferred:** Pyrola agents share the active project root. Worktree management touches git state, file watcher paths, LSP roots, and UI project switching — high coordination cost.

**Rough approach:** Tauri commands to create/remove worktrees under `.pyrola/worktrees/<agent-id>`; pass isolated `projectRoot` into harness context for cloud/subagent runs. UI shows worktree badge and cleanup on agent completion.

### Debug mode

**What:** A dedicated harness variant and UI mode for systematic troubleshooting — runtime evidence collection, structured hypothesis loop, separate tool allowlist (Cursor Debug mode).

**Why deferred:** Pyrola has four user-selected chat modes (Ask, Plan, Studio, Agent) but no agent-invoked or user "Debug" mode with distinct prompts and tooling.

**Rough approach:** Add `debug` chat mode (or mode skill) with read-heavy tools, structured logging to a debug panel, and optional integration with terminal output / diagnostics. Mirror Cursor's evidence-first prompt template.

### Sandbox / smart-mode auto-review classifier

**What:** Pre-execution classifier that blocks or gates risky tool calls (destructive shell, network, file deletes outside workspace) and surfaces a smart-mode approval card — beyond Pyrola's current write-approval gate.

**Why deferred:** Write mutations already go through `approval-gate`; command sandboxing and ML/heuristic classification are separate hard problems with false-positive UX risk.

**Rough approach:** Rule-based classifier first (path glob, command denylist, network host allowlist) in the orchestrator before tool dispatch; optional LLM second pass for ambiguous `run_terminal` commands. Reuse approval-gate UI with a "smart review" reason field.

### MCP Resources, Prompts, Elicitation, and Apps

**What:** Full MCP surface beyond tools: `FetchMcpResource` / resource subscribe, server-defined prompt templates, server-driven elicitation flows, and MCP Apps extensions.

**Why deferred:** Pyrola MCP runtime is tools-focused (`mcp_call_tool`, `mcp_status`). Resources and prompts need Tauri transport, caching, and harness tool wrappers; OAuth 2.1 for MCP auth is still on the roadmap (`docs/STATUS.md`).

**Rough approach:** Extend Tauri `mcp` module with `mcp_read_resource`, `mcp_list_resources`, `mcp_get_prompt`; add harness tools `fetch_mcp_resource` and `get_mcp_prompt`. Map MCP elicitation to `ask_user` where possible; defer MCP Apps until extension host design is clear.

### Subagents — nested, typed, and agent-resumable (beyond Workstream G)

**What:** Remaining sub-agent parity after Workstream G shipped non-blocking children and harness-level turn resume.

**Already shipped (Workstream G):**

- `spawn_subagent` with `blocking: false` — parent continues the turn while the child runs
- `subagent-registry` + `resumeOrchestrator` — parent turn completes when the background child finishes
- Nested tool events (`subagent-event`) visible to the parent thread

**Still deferred:**

| Todo | What remains | Why | Rough approach |
|------|--------------|-----|----------------|
| **Agent-resumable subagents** | `resume` parameter on `spawn_subagent` to continue a prior child by ID with a new prompt | Registry stores turn messages but no public resume API for the agent | Add `resume: subagentId` to tool schema; reload persisted messages from registry and call `runSubagentGenerate` with extended context |
| **Nested subagents** | Child agents that can spawn their own children | Nested ctx excludes `spawn_subagent` to prevent runaway depth | Depth-limited recursion (max 2–3); parent sees grandchild events via propagated `subagent-event` |
| **Sub-agent type selection** | `explore`, `shell`, `generalPurpose`, `bugbot`, etc. | Single read-only sub-agent profile today | `subagent-type` catalog mapping types to tool allowlists and system prompts |
| **Cloud / isolated subagents** | Separate VM or git worktree per child | No cloud runtime or worktree isolation | Depends on [Agent git worktrees](#agent-git-worktrees) and optional cloud agent provider integration |

**Rough approach (umbrella):** Extend `spawn_subagent` schema (`resume`, `subagentType`, `environment: local | cloud`); build subagent picker UI in the thread timeline for running/completed children; wire Orchestrator mode as the multi-subagent coordinator.

---

## Related docs

- [STATUS.md](./STATUS.md) — v1 roadmap and known limitations
- [git-informational plan](../.pyrola/plans/git-informational-2026-07-15-221700/PLAN.md) — intentional read-only git scope
- [agent-harness plan](../.pyrola/plans/agent-harness-2026-07-15-215200/PLAN.md) — harness architecture
- [mcp-client plan](../.pyrola/plans/mcp-client-2026-07-15-232000/PLAN.md) — MCP runtime and OAuth roadmap
