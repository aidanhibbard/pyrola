# Desktop shell

Pyrola ships as a Tauri 2 desktop app (`src-tauri/`).

## Shell responsibilities

- Host the Vue Agents UI in a frameless, transparent window.
- Expose IPC commands for filesystem, chat persistence, keychain, MCP process lifecycle, terminals, LSP installs, and fleet registry.
- Provide tray behavior so closing the window can keep the app available (when enabled).

## Why Tauri

- Keep the agent loop and tools on the local machine.
- Store secrets in the OS keychain.
- Avoid a hosted chat backend for the core product path.

## Develop and build

- Run `npm run tauri dev` for the full shell.
- Run `npm run tauri build` for platform bundles.
- See [Install](../guide/install.md) for PATH / CLI notes.

## Embedded browser view stacking (macOS)

When built with the optional `cef` cargo feature on macOS, the workbench
Browser tab embeds Chromium as a native child `NSView` **behind** Tauri's
`WKWebView`, not above it. Opaque Vue chrome (toolbar, address bar, bookmark
bar, console, sidebars) paints in the webview. A transparent CSS hole at the
browser host lets the CEF surface show through. Stacking is applied after
create and resize in
[browser-cef-stacking.rs](../../src-tauri/src/commands/browser-cef-stacking.rs)
(WKWebView background cleared via KVC so the hole is not painted opaque).

Tauri/Tao's `NSApplication` subclass does not implement Chromium's
`CrAppProtocol` (`isHandlingSendEvent` / `setHandlingSendEvent:`). Without it,
CEF event paths such as `close_browser` and native selects crash with
`unrecognized selector isHandlingSendEvent`. At CEF warm-init, before
`cef::initialize`, the app patches the live application class in
[browser-cef-cr-app-protocol.rs](../../src-tauri/src/commands/browser-cef-cr-app-protocol.rs).

AppKit ignores CSS transparency for hit-testing, so clicks on the hole would
still hit `WKWebView`. A content-view `hitTest:` override in
[browser-cef-hit-test.rs](../../src-tauri/src/commands/browser-cef-hit-test.rs)
skips the webview inside rects published by
`browser_cef_set_passthrough_rects`. The frontend publishes the active host
rect on show/resize and clears it when CEF is hidden, the tab is inactive, or
a Vue overlay (for example the workbench tab picker) covers the hole
([use-browser-passthrough-suspend.ts](../../src/composables/use-browser-passthrough-suspend.ts)).

This stacking and hit-test model is macOS-only.

### Manual verification

On a CEF-enabled macOS build:

- Close a browser tab from the workbench header: the app stays alive (no
  `isHandlingSendEvent` crash).
- Open the `+` tab picker over a visible browser page: the full Editor /
  Terminal / Browser / Changes menu is visible and clickable.
- Click a link or input on the embedded page through the hole: the page
  receives the click.
- Toolbar, address bar, bookmark bar, and console remain interactive.
- Switch away from the browser tab: CEF hides, passthrough clears, and other
  tabs work.
- Switch back: the page reappears and clicks reach it again.
- CDP tools (harness browser tools) still attach and operate on the page.

## Related

- [Architecture overview](./overview.md)
- [CLI](../guide/cli.md)
- [CEF bundling](../guide/cef-bundling.md)
