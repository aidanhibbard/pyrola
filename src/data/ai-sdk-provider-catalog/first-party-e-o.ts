import { aiSdk } from './helpers'

export default [
  aiSdk({
    id: 'elevenlabs',
    name: 'ElevenLabs',
    packageName: '@ai-sdk/elevenlabs',
    models: ['eleven_multilingual_v2'],
  }),
  aiSdk({
    id: 'fal',
    name: 'Fal',
    packageName: '@ai-sdk/fal',
    models: ['fal-ai/flux/dev'],
  }),
  aiSdk({
    id: 'fireworks',
    name: 'Fireworks',
    packageName: '@ai-sdk/fireworks',
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
    models: [
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
      'accounts/fireworks/models/deepseek-v3',
    ],
  }),
  aiSdk({
    id: 'gladia',
    name: 'Gladia',
    packageName: '@ai-sdk/gladia',
    models: ['gladia/solaria'],
  }),
  aiSdk({
    id: 'google',
    name: 'Google',
    packageName: '@ai-sdk/google',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview'],
  }),
  aiSdk({
    id: 'google-vertex',
    name: 'Google Vertex AI',
    packageName: '@ai-sdk/google-vertex',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview'],
  }),
  aiSdk({
    id: 'groq',
    name: 'Groq',
    packageName: '@ai-sdk/groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
  }),
  aiSdk({
    id: 'huggingface',
    name: 'Hugging Face',
    packageName: '@ai-sdk/huggingface',
    models: ['meta-llama/Llama-3.1-8B-Instruct', 'moonshotai/Kimi-K2-Instruct'],
  }),
  aiSdk({
    id: 'hume',
    name: 'Hume',
    packageName: '@ai-sdk/hume',
    models: ['hume/emotional-language'],
  }),
  aiSdk({
    id: 'klingai',
    name: 'Kling AI',
    packageName: '@ai-sdk/klingai',
    models: ['kling-v1'],
  }),
  aiSdk({
    id: 'lmnt',
    name: 'LMNT',
    packageName: '@ai-sdk/lmnt',
    models: ['lmnt/default'],
  }),
  aiSdk({
    id: 'luma',
    name: 'Luma',
    packageName: '@ai-sdk/luma',
    models: ['luma/ray-2'],
  }),
  aiSdk({
    id: 'mistral',
    name: 'Mistral AI',
    packageName: '@ai-sdk/mistral',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-small-latest', 'pixtral-large-latest'],
  }),
  aiSdk({
    id: 'moonshotai',
    name: 'Moonshot AI',
    packageName: '@ai-sdk/moonshotai',
    models: ['kimi-k2.5', 'kimi-k2-thinking'],
  }),
  aiSdk({
    id: 'open-responses',
    name: 'Open Responses',
    packageName: '@ai-sdk/open-responses',
    models: ['openai/gpt-4o'],
  }),
  aiSdk({
    id: 'openai',
    name: 'OpenAI',
    packageName: '@ai-sdk/openai',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-5-mini'],
  }),
]
