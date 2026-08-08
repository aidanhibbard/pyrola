# CLI

Launch Pyrola with an optional project path.

## Open a project

- Run `pyrola .` from a repo to open that directory.
- Run `pyrola /absolute/path/to/repo` to open a specific path.
- Confirm first launch registers the directory in the fleet and sets it active.
- Confirm later launches activate an already registered project.

Relative paths resolve from your current working directory.

## Install the command

- Build with `npm run tauri build`.
- Symlink the release binary onto your PATH (see [Install](./install.md)).

On macOS without PATH install:

```sh
open -a pyrola --args /path/to/repo
```

## Known limitation

- Launch `pyrola /path` while the app is already running and a second instance may start.
- Prefer focusing the existing window manually until single-instance handoff ships.

## Related

- [Install](./install.md)
- [Fleet and projects](./fleet-and-projects.md)
