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

## Related

- [Architecture overview](./overview.md)
- [CLI](../guide/cli.md)
