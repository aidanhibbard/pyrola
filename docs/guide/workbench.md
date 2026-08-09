# Workbench

The right workbench sits beside the agent thread. Tabs share the active project context.

## Editor

- Open files from the project tree into Monaco tabs.
- Edit and save with dirty-state tracking.
- Use markdown Edit / Split / Preview when viewing markdown.
- Rely on managed language servers the app can install (TypeScript, Vue, and others). Language support is always on in the desktop app; manage installs under Settings, LSP.

## Terminal

- Open a human PTY tab for interactive use in the active project.
- Expand Running terminals in the composer to see live agent shells from `run_terminal`.
- Click a row to open a read-only agent shell tab with live stdout and stderr.
- Stop (ghost button) kills that shell.

## Changes

- Open Changes for an informational git view (status and diffs).
- Use it to inspect workspace changes; it is not a full git client replacement.

## Plan

- Open the Plan tab when a chat produces a plan under `.pyrola/plans/`.
- Use Done / Build / Built states and the orchestrate flow from the plan UI.

## Studio

- Open Studio to view Comark artifacts under `.pyrola/studio/`.
- Refresh, copy markdown, and export PDF from the studio toolbar.
- Agents publish artifacts via the `write_studio_artifact` tool.

## Related

- [Plans and Studio](./plans-and-studio.md)
- [Agents UI](./agents-ui.md)
- [Modes](./modes.md)
