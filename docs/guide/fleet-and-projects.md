# Fleet and projects

Pyrola keeps a fleet of registered projects. Chats are scoped per project slug and stored in app data.

## Register and switch projects

- Open the left fleet sidebar.
- Add a project directory so it appears in the fleet registry.
- Select a project to make it the active project.
- Confirm the sidebar shows chats for that project slug.

## Home chats

- Start a chat from home when you do not need a project workspace.
- Use home-scope chats for prompts that do not target a registered repo.
- Switch to a project chat when tools should run against a workspace root.

## Pin chats

- Pin a chat from the chat list when you want it easy to find.
- Unpin when it no longer needs to stay at the top of the fleet view.

## Open a project from the CLI

- Run `pyrola .` or `pyrola /path/to/repo` after the CLI is on your PATH.
- Confirm the path is registered (or activated if it already exists) on launch.

Details: [CLI](./cli.md).

## Related

- [Agents UI](./agents-ui.md)
- [Data and config](../architecture/data-and-config.md)
