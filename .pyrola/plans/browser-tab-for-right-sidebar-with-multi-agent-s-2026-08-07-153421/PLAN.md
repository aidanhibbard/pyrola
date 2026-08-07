---
id: browser-tab-for-right-sidebar-with-multi-agent-s-2026-08-07-153421
title: "Browser Tab for Right Sidebar with Multi-Agent Sharing"
createdAt: 2026-08-07T22:34:21.628Z
mode: plan
sourceChatId: 7e3c43cf-f4a7-464a-a2e5-8696ee76ee60
  - id: types-store
    content: "Add browser tab type and payload to workbench-tab.ts, add openBrowser/closeBrowser to use-workbench-store.ts"
    status: pending
  - id: frontend-components
    content: "Create BrowserTab.vue, BrowserView.vue, BrowserToolbar.vue; update WorkbenchTabContent, WorkbenchTabPicker, WorkbenchHeader"
    status: pending
  - id: tauri-backend
    content: "Create browser.rs commands (spawn, navigate, back, forward, screenshot, close); add BrowserSessionRegistry to lib.rs"
    status: pending
  - id: harness-tools
    content: "Add browser harness tools (browser_navigate, browser_back, browser_forward, browser_screenshot, browser_get_content) to build-tools.ts"
    status: pending
  - id: agent-integration
    content: "Wire agent harness to auto-create browser sessions, add URL label display, error states, session cleanup"
    status: pending
  - id: test-plan
    content: "Write tests for store logic, component mounting, harness tools, and Tauri backend browser commands"
    status: pending
  - id: types-store
    content: "Add browser tab type and payload to workbench-tab.ts, add openBrowser/closeBrowser to use-workbench-store.ts"
    status: in_progress
  - id: frontend-components
    content: "Create BrowserTab.vue, BrowserView.vue, BrowserToolbar.vue; update WorkbenchTabContent, WorkbenchTabPicker, WorkbenchHeader"
    status: pending
  - id: tauri-backend
    content: "Create browser.rs commands (spawn, navigate, back, forward, screenshot, close); add BrowserSessionRegistry to lib.rs"
    status: pending
  - id: harness-tools
    content: "Add browser harness tools (browser_navigate, browser_back, browser_forward, browser_screenshot, browser_get_content) to build-tools.ts"
    status: pending
  - id: agent-integration
    content: "Wire agent harness to auto-create browser sessions, add URL label display, error states, session cleanup"
    status: pending
  - id: test-plan
    content: "Write tests for store logic, component mounting, harness tools, and Tauri backend browser commands"
    status: pending
builtAt: 2026-08-07T22:41:40.747Z
lastBuildChatId: 7e3c43cf-f4a7-464a-a2e5-8696ee76ee60
lastBuildModel: "local::qwen3.6-35b-a3b"
todos:
  - id: types-store
    content: "Add browser tab type and payload to workbench-tab.ts, add openBrowser/closeBrowser to use-workbench-store.ts"
    status: in_progress
  - id: frontend-components
    content: "Create BrowserTab.vue, BrowserView.vue, BrowserToolbar.vue; update WorkbenchTabContent, WorkbenchTabPicker, WorkbenchHeader"
    status: pending
  - id: tauri-backend
    content: "Create browser.rs commands (spawn, navigate, back, forward, screenshot, close); add BrowserSessionRegistry to lib.rs"
    status: pending
  - id: harness-tools
    content: "Add browser harness tools (browser_navigate, browser_back, browser_forward, browser_screenshot, browser_get_content) to build-tools.ts"
    status: pending
  - id: agent-integration
    content: "Wire agent harness to auto-create browser sessions, add URL label display, error states, session cleanup"
    status: pending
  - id: test-plan
    content: "Write tests for store logic, component mounting, harness tools, and Tauri backend browser commands"
    status: pending
---

## Summary

Add a new `browser` tab type to the right sidebar workbench that renders a WKWebView-based browser. Multiple agents can share the same browser instance -- navigating, clicking, and reading page content are all exposed as harness tools. The browser tab persists across agent sessions and is accessible from the tab picker dropdown.

## Context

- **App**: Tauri 2 + Vue 3 (Vite) desktop app called Pyrola
- **Right sidebar**: Uses `ResizablePanelGroup` with collapsible panel; hosts `WorkbenchHeader` (tab bar) and `WorkbenchShell` (tab content switcher)
- **Tab system**: Singleton store in `use-workbench-store.ts` with typed tabs, tab lifecycle (open/close/focus/reorder), and a component map in `WorkbenchTabContent.vue`
- **Existing tab types**: `changes`, `editor`, `terminal`, `studio`, `plan`
- **Agent harness**: `build-tools.ts` defines tools via the `ai` package `tool()` API; tools call Tauri IPC commands defined in `src-tauri/src/commands/`
- **Tauri backend**: Rust, already depends on `objc2-web-kit` for macOS traffic-light hiding; uses `portable-pty` for terminals
- **Key pattern**: Tab type -> payload type -> store method -> component in map -> Tauri IPC for back-end operations

## Architecture

```mermaid
graph TB
    subgraph "Frontend (Vue)"
        A[WorkbenchTabPicker.vue] -->|Add "Browser" item| B[use-workbench-store.ts]
        B -->|openBrowser()| C[WorkbenchTabContent.vue]
        C -->|browser type| D[BrowserTab.vue]
        D -->|iframe with src| E[BrowserToolbar.vue]
        E -->|navigate/forward/back| F[BrowserView.vue]
    end

    subgraph "Tauri Backend (Rust)"
        G[commands/browser.rs] -->|spawn_browser| H[WKWebView instance]
        G -->|navigate| H
        G -->|go_back| H
        G -->|go_forward| H
        G -->|get_page_content| H
        G -->|close_browser| I[BrowserSessionRegistry]
        H -->|web view| I
    end

    subgraph "Agent Harness"
        J[build-tools.ts] -->|browser_navigate tool| K[pyrola-tauri.ts]
        J -->|browser_back tool| K
        J -->|browser_forward tool| K
        J -->|browser_screenshot tool| K
        K -->|invoke| G
    end

    B -->|shared session id| K
    I -->|shared session| B
```

### Data flow

1. **User/agent opens browser**: `workbench.openBrowser(projectId)` creates a tab with `type: 'browser'` and a unique `sessionId`
2. **Tab renders**: `BrowserTab.vue` mounts a `BrowserView` component that loads the Tauri webview
3. **Agent controls browser**: Harness tools call Tauri IPC commands that operate on the shared `BrowserSessionRegistry`
4. **Multiple agents**: Each agent harness gets the same `sessionId` via the workbench store, so they all control the same browser instance

### Key files to modify/create

| File | Action |
|------|--------|
| `src/types/workbench/workbench-tab.ts` | Add `browser` to `WorkbenchTabType`, add `BrowserPayload` type |
| `src/composables/use-workbench-store.ts` | Add `openBrowser()`, `closeBrowser()`, `browserSessions` Map |
| `src/components/workbench/WorkbenchTabContent.vue` | Add `browser` to `tabComponentMap` |
| `src/components/workbench/WorkbenchTabPicker.vue` | Add "Browser" item to dropdown |
| `src/components/workbench/WorkbenchHeader.vue` | Add `Browser` icon to `tabIcon()` |
| `src/components/workbench/tabs/BrowserTab.vue` | New -- hosts BrowserView + BrowserToolbar |
| `src/components/workbench/tabs/BrowserView.vue` | New -- renders Tauri webview via iframe or Tauri webview window |
| `src/components/workbench/tabs/BrowserToolbar.vue` | New -- address bar + nav buttons |
| `src/services/pyrola/pyrola-tauri.ts` | Add browser IPC functions |
| `src-tauri/src/commands/mod.rs` | Export browser commands |
| `src-tauri/src/commands/browser.rs` | New -- browser spawn/navigate/back/forward/screenshot |
| `src-tauri/src/lib.rs` | Register browser commands, add BrowserSessionRegistry |
| `src/services/harness/build-tools.ts` | Add `browser_navigate`, `browser_back`, `browser_forward`, `browser_screenshot` tools |
| `src/services/harness/tool-catalog.ts` | Add tool descriptions |
| `src/types/harness/harness-event.ts` | Optionally add `browser-event` type |

## Approach

### Phase 1: Type and store layer

1. Extend `WorkbenchTabType` in `workbench-tab.ts` to include `'browser'`
2. Add `BrowserPayload = { sessionId: string; url: string }`
3. Add `browserSessions: Map<string, { sessionId: string; url: string }>` to the workbench store
4. Add `openBrowser(projectId, initialUrl?)` -- creates tab, generates sessionId, stores session
5. Add `closeBrowser(sessionId)` -- cleans up session Map entry
6. Export `getBrowserSession(sessionId)` helper

### Phase 2: Frontend tab component

1. Create `BrowserTab.vue` -- receives `tab: WorkbenchTab`, extracts payload, renders `BrowserView` and `BrowserToolbar`
2. Create `BrowserToolbar.vue` -- address bar input, back/forward/refresh buttons, URL display
3. Create `BrowserView.vue` -- renders the browser view. For Tauri, use a dedicated `WebviewWindow` or `Webview` embedded in the sidebar panel. Since the sidebar is already a panel, we need to embed a webview. On macOS, this means using `NSView` hosting a `WKWebView`. This is the most complex part.
4. Update `WorkbenchTabContent.vue` to map `browser` -> `BrowserTab`
5. Update `WorkbenchTabPicker.vue` to add "Browser" to the dropdown items
6. Update `WorkbenchHeader.vue` to add a browser icon (use `Globe` from `@lucide/vue`)

### Phase 3: Tauri backend

1. Create `src-tauri/src/commands/browser.rs` with commands:
   - `spawn_browser` -- creates a new `WKWebView` wrapped in a session, returns `sessionId`
   - `browser_navigate(sessionId, url)` -- navigates to URL
   - `browser_back(sessionId)` -- goes back
   - `browser_forward(sessionId)` -- goes forward
   - `browser_reload(sessionId)` -- reloads
   - `browser_get_content(sessionId)` -- gets page HTML/content
   - `browser_screenshot(sessionId)` -- takes a screenshot (returns base64)
   - `close_browser(sessionId)` -- destroys the webview
2. Create `BrowserSessionRegistry` in `lib.rs` to track active browser sessions
3. Register commands in `invoke_handler`
4. Add `tauri-plugin-webview` or use native `objc2-web-kit` bindings

### Phase 4: Harness tools

1. Add to `build-tools.ts`:
   - `browser_navigate` -- navigate to URL, optional `session_id` to share
   - `browser_back` -- go back in history
   - `browser_forward` -- go forward
   - `browser_screenshot` -- capture current page as base64 image
   - `browser_get_content` -- get page text/HTML content
2. Add to `tool-catalog.ts` descriptions
3. Tools should auto-create a browser session if none exists for the chat, or accept an explicit `session_id` for sharing

### Phase 5: Agent integration

1. Agents can spawn a browser tab from chat by calling `browser_navigate`
2. The tool returns the `sessionId` which gets linked to the workbench tab
3. Multiple agents in the same chat share the same browser via the same `sessionId`
4. Screenshot results can be used as vision input for the next model turn

### Phase 6: Polish

1. Browser tab label shows current URL (truncated)
2. Dirty indicator when page is loading
3. Keyboard shortcut to open browser tab
4. Browser session cleanup when project changes or chat closes
5. Error states (navigation failures, etc.)

## Test plan

1. **Unit tests**: Workbench store `openBrowser`/`closeBrowser` logic, payload type serialization
2. **Component tests**: `BrowserToolbar` URL input and navigation buttons, `BrowserTab` mounting/unmounting lifecycle
3. **Integration tests**:
   - Open browser tab from picker, verify tab appears in header
   - Navigate to URL, verify URL updates in toolbar and tab label
   - Back/forward buttons work correctly
   - Multiple agents share same session (same sessionId, same page state)
   - Close browser tab cleans up session
4. **Tauri backend tests**: Spawn/destroy browser sessions, navigate, screenshot capture
5. **Harness tool tests**: `browser_navigate`, `browser_screenshot` return correct data shapes