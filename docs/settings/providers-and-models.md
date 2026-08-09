# Providers and Models

Configure BYOK providers and default models per chat role.

## Providers

- Open Settings, Personal, Providers.
- Add an AI SDK catalog provider or a Custom OpenAI-compatible endpoint.
- Enter the API key and save it to the OS keychain.
- Test the connection when the UI offers a test action.
- Remove a provider only after you no longer need its models.

Guide: [Providers and BYOK](../guide/providers-and-byok.md).

## Models

- Open Settings, Personal, Models.
- Assign a model for each internal agent: Default, Ask, Plan, Studio, Agent, Orchestrator (parent and subagent), Title, and Compaction.
- In the model picker, models are grouped by name. Use the gear on a row to set reasoning (when the provider supports effort), fast mode, and whether the model is allowed in chat.
- Chat and orchestrate pickers hide models marked not allowed.
- Title and Compaction warn when they inherit the default model; prefer a small low-cost model for those tasks.
- Markdown agents under `.pyrola/agents/` set their own `model` and `reasoning` in frontmatter; they are not listed here.
- Pick models that exist on providers you already configured.
- Start a chat and confirm the mode uses the model you selected.
- Local and custom OpenAI-compatible models only show reasoning effort when you list levels under `supportsReasoningEffort` on the model. A `thinking` flag alone enables thinking tokens, not portable effort levels.

## Related

- [Settings overview](./overview.md)
- [Getting started](../guide/getting-started.md)
