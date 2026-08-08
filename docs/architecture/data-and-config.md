# Data and config

Pyrola is local-first. There is no cloud sync of chats or settings.

## App data (user)

User data lives in the platform app-data directory for identifier `app.pyrola`, under a `.pyrola/` folder. Typical contents:

- `projects.json` and `active-project.json` (fleet)
- `chats/<project-slug>/...` (per-project chat transcripts and meta)
- Personal settings and related config
- LSP and runtime caches

Exact filesystem roots differ by OS (for example Application Support on macOS). The app creates the directory on first run.

## Project data

Each registered project may have `<project>/.pyrola/`:

- `settings.json` and `mcp.json` when configured
- `plans/` for plan documents
- `studio/` for Comark artifacts
- `skills/`, agent files, and rules

Pyrola walks parents a limited depth to find an existing project `.pyrola` with config.

## Secrets

- Provider API keys and MCP secrets use the OS keychain via Tauri commands.
- Do not commit keychain material into git.
- Chat text can still contain secrets you paste; treat threads as sensitive local files.

## Related

- [Settings overview](../settings/overview.md)
- [Fleet and projects](../guide/fleet-and-projects.md)
- [Security](../guide/security.md)
