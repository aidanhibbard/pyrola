# Providers and BYOK

BYOK means bring your own key. Pyrola does not host model accounts for the core loop. You configure providers and store secrets in the OS keychain.

## What BYOK means here

- Add providers you already pay for (or local OpenAI-compatible servers).
- Keep API keys in the OS keychain via Settings.
- Call models through the local harness with the Vercel AI SDK.
- Skip a Pyrola cloud login for chat and agent turns.

## Add a catalog provider

- Open Settings, Personal, Providers.
- Add a first-party AI SDK provider (OpenAI, Anthropic, Google, Amazon Bedrock, Azure, AI Gateway, Alibaba, and others in the catalog).
- Enter the API key and save so it is written to the keychain.
- Open Models and assign defaults per chat mode role.

## Add a custom OpenAI-compatible endpoint

- Open Settings, Personal, Providers.
- Add a Custom OpenAI-compatible provider.
- Set base URL, headers, and model list for your endpoint.
- Save credentials to the keychain when the endpoint requires a key.
- Select those models in Models for the modes you use.

## Verify the connection

- Use the provider test action in Settings when available.
- Start a short Ask-mode chat that does not need tools.
- Confirm a streamed reply arrives from the selected model.

## Related

- [Providers and Models](../settings/providers-and-models.md)
- [Getting started](./getting-started.md)
- [Security](./security.md)
