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
- In the model picker, models are grouped by vendor (OpenAI, Anthropic, Moonshot, and so on). Fast variants (for example `kimi-k3-fast`) collapse into the base model; use the gear menu Fast toggle instead of picking a separate row.
- Use the gear on a row to set reasoning (when the provider supports effort), fast mode (when a fast tier exists), and whether the model is allowed in chat.
- Chat and orchestrate pickers hide models marked not allowed.
- Title and Compaction warn when they inherit the default model; prefer a small low-cost model for those tasks.
- Markdown agents under `.pyrola/agents/` set their own `model` and `reasoning` in frontmatter; they are not listed here.
- Pick models that exist on providers you already configured.
- Start a chat and confirm the mode uses the model you selected.
- Local and custom OpenAI-compatible models only show reasoning effort when you list levels under `supportsReasoningEffort` on the model. A `thinking` flag alone enables thinking tokens, not portable effort levels.

## Cost tracking

Pyrola records per-call token usage and optional USD cost into a chat usage ledger. Totals roll up per turn and per chat.

### Pricing on custom models

- On a custom OpenAI-compatible model, you can set USD rates per 1M tokens: input and output (required together when any pricing field is set).
- Optional: cache read, cache write, and reasoning rates per 1M tokens.
- When rates are used, cache tokens are billed exclusively (uncached input, cache read, and cache write are not double-counted as input).

### Confidence levels

Cost confidence is labeled by source:

- `provider_reported`: OpenRouter-style `raw.cost`, or AI Gateway after `getGenerationInfo` enrich.
- `user_configured`: your custom or direct model rates.
- `catalog_estimate`: a catalog price estimate (shown as an estimate, not a bill).
- `none`: no cost available. The UI shows a warning icon instead of inventing `$0`.

Provider-reported cost always wins over rate math when both are available.

### Per-turn aggregates

- A turn aggregate includes the main agent steps and any subagents that share the same `turnId`.
- If any part of the turn has a null cost, the turn `costUSD` is null (not treated as zero).
- Missing usage on any part sets `usageMissing` on the turn aggregate.

### Context window vs API usage

- The context window bar is an estimate of prompt size. It is never used for billing.
- Billed usage comes only from API-reported tokens (and provider cost or configured rates). Treat those as separate signals.

## Related

- [Settings overview](./overview.md)
- [Getting started](../guide/getting-started.md)
