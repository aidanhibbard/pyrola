import { aiSdk, openAiCompatible } from './helpers'

export default [
  aiSdk({
    id: 'perplexity',
    name: 'Perplexity',
    packageName: '@ai-sdk/perplexity',
    models: ['sonar', 'sonar-pro'],
  }),
  aiSdk({
    id: 'prodia',
    name: 'Prodia',
    packageName: '@ai-sdk/prodia',
    models: ['prodia/flux'],
  }),
  aiSdk({
    id: 'quiverai',
    name: 'QuiverAI',
    packageName: '@ai-sdk/quiverai',
    models: ['quiver/default'],
  }),
  aiSdk({
    id: 'replicate',
    name: 'Replicate',
    packageName: '@ai-sdk/replicate',
    models: ['meta/meta-llama-3-8b-instruct'],
  }),
  aiSdk({
    id: 'revai',
    name: 'Rev.ai',
    packageName: '@ai-sdk/revai',
    models: ['revai/default'],
  }),
  aiSdk({
    id: 'togetherai',
    name: 'Together.ai',
    packageName: '@ai-sdk/togetherai',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    models: [
      'meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo',
      'deepseek-ai/DeepSeek-V3',
    ],
  }),
  aiSdk({
    id: 'vercel',
    name: 'Vercel',
    packageName: '@ai-sdk/vercel',
    models: ['v0-1.0-md'],
  }),
  aiSdk({
    id: 'voyage',
    name: 'Voyage AI',
    packageName: '@ai-sdk/voyage',
    models: ['voyage-3'],
  }),
  aiSdk({
    id: 'xai',
    name: 'xAI Grok',
    packageName: '@ai-sdk/xai',
    defaultBaseUrl: 'https://api.x.ai/v1',
    models: ['grok-4', 'grok-3-mini'],
  }),
  openAiCompatible({
    id: 'clarifai',
    name: 'Clarifai',
    defaultBaseUrl: 'https://api.clarifai.com/v2',
    models: ['clarifai/default'],
  }),
  openAiCompatible({
    id: 'heroku',
    name: 'Heroku',
    models: ['heroku/default'],
  }),
  openAiCompatible({
    id: 'lmstudio',
    name: 'LM Studio',
    defaultBaseUrl: 'http://localhost:1234/v1',
    models: ['local-model'],
    requiresApiKey: false,
  }),
  openAiCompatible({
    id: 'near-ai',
    name: 'NEAR AI Cloud',
    models: ['near-ai/default'],
  }),
  openAiCompatible({
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    models: ['meta/llama-3.1-8b-instruct'],
  }),
  openAiCompatible({
    id: 'ollama',
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2'],
    requiresApiKey: false,
  }),
  openAiCompatible({
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-sonnet-4', 'openai/gpt-4o'],
  }),
]
