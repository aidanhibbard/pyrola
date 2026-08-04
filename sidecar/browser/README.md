# Browser sidecar (removed)

The Playwright Chromium sidecar was removed. Pyrola embeds a real Tauri child webview
(WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux) owned by
`src-tauri/src/commands/browser.rs`.

Agent tools use navigate + JS eval against that same webview. CDP is not available.
