# Getting started

First-run walkthrough after [Install](./install.md). Each step starts with a verb and ends with the outcome.

## Add a provider and model

- Open Settings from the app chrome or command palette.
- Select the Personal tab and open Providers.
- Add a provider from the AI SDK catalog, or add a Custom OpenAI-compatible endpoint with base URL and model list.
- Save the API key so it is stored in the OS keychain.
- Open Models and select a default model for Agent mode (and other modes you use).

Details: [Providers and BYOK](./providers-and-byok.md) and [Providers and Models](../settings/providers-and-models.md).

## Open a project

- Open the fleet sidebar on the left.
- Add or select a project directory so it becomes the active project.
- Confirm chats for that project appear under the project in the sidebar.

Details: [Fleet and projects](./fleet-and-projects.md).

## Start an agent turn

- Create a new chat for the active project (or use home-scope chat if you have no project).
- Select Agent mode for file edits and terminal tools, or Ask mode for read-only exploration.
- Set the permission dial to Ask if you want approval prompts for writes and shell.
- Send a prompt that asks the agent to read a file in the project.
- Confirm the thread streams a reply and shows tool cards when tools run.

## Use the workbench

- Open the Editor tab from the right workbench when the agent touches a file you want to inspect.
- Open the Terminal tab when you want a human shell in the same project.
- Open Changes for an informational git view of the workspace.

Details: [Workbench](./workbench.md) and [Agents UI](./agents-ui.md).

## Next steps

- [Modes](./modes.md)
- [MCP](./mcp.md)
- [Security](./security.md)
- [FAQ](../faq.md)
