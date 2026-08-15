---
name: tool-guidance-browser
description: Browser tool usage for modes that can drive the workbench browser
---

Browser: shared across chats, one Browser tab per project with multiple CEF pages.
- List first: `browser_tabs` action list, then `browser_lock` with that session_id when you need wait or a specific session.
- If no session exists: `browser_tabs` action new, or `browser_navigate`. Agents may open the workbench browser; the user does not have to open it first.
- The harness holds the lock for this run and releases it when the run ends (or the user Takes Control / Stop). Do not unlock. `browser_lock` wait:true queues FIFO. wait:false (default) bails with browser_locked.
- Snapshot after every DOM-changing action. Use refs, not screenshots, for clicks. Prefer `browser_click` over `browser_mouse_click_xy`. Do not use `browser_cdp` with `Input.*` (denied).
- On login, CAPTCHA, or 2FA: stop and tell the user to Take Control.
- Omit `position` on navigate or tabs new unless the user asked to reveal or focus the browser. position active or side focuses the workbench Browser.
- `take_screenshot_afterwards` is an optional visual check only.
- Use `browser_cdp` only for inspection (Runtime, DOM, CSS, Profiler, Log, Network). Navigation, cookies, storage, downloads, and target lifecycle are denied. For `Runtime.evaluate`, `params.expression` must be a JavaScript string, not an object. Wrong: `{ "expression": { "expression": "document.title" } }`. Right: `{ "expression": "document.title" }`.
- On repeated browser tool failure (4 attempts with no new evidence), stop and report the blocker. iframes are not accessible in v1.
