import { aiSdk } from './helpers'

export default [
  aiSdk({
    id: 'gateway',
    name: 'AI Gateway',
    packageName: '@ai-sdk/gateway',
    models: ['openai/gpt-4o'],
  }),
  aiSdk({
    id: 'alibaba',
    name: 'Alibaba',
    packageName: '@ai-sdk/alibaba',
    models: ['qwen3-max', 'qwen-plus'],
  }),
  aiSdk({
    id: 'amazon-bedrock',
    name: 'Amazon Bedrock',
    packageName: '@ai-sdk/amazon-bedrock',
    models: ['anthropic.claude-sonnet-4-5', 'amazon.nova-pro-v1:0'],
  }),
  aiSdk({
    id: 'anthropic',
    name: 'Anthropic',
    packageName: '@ai-sdk/anthropic',
    models: ['claude-sonnet-4-5', 'claude-opus-4-6', 'claude-haiku-4-5'],
  }),
  aiSdk({
    id: 'assemblyai',
    name: 'AssemblyAI',
    packageName: '@ai-sdk/assemblyai',
    models: ['assemblyai/universal'],
  }),
  aiSdk({
    id: 'azure',
    name: 'Azure OpenAI',
    packageName: '@ai-sdk/azure',
    models: ['gpt-4o', 'gpt-4o-mini'],
  }),
  aiSdk({
    id: 'baseten',
    name: 'Baseten',
    packageName: '@ai-sdk/baseten',
    models: [
      'Qwen/Qwen3-235B-A22B-Instruct-2507',
      'deepseek-ai/DeepSeek-V3.1',
      'moonshotai/Kimi-K2-Instruct-0905',
    ],
  }),
  aiSdk({
    id: 'black-forest-labs',
    name: 'Black Forest Labs',
    packageName: '@ai-sdk/black-forest-labs',
    models: ['flux-pro-1.1'],
  }),
  aiSdk({
    id: 'bytedance',
    name: 'ByteDance',
    packageName: '@ai-sdk/bytedance',
    models: ['doubao-pro-32k'],
  }),
  aiSdk({
    id: 'cartesia',
    name: 'Cartesia',
    packageName: '@ai-sdk/cartesia',
    models: ['sonic-2'],
  }),
  aiSdk({
    id: 'cerebras',
    name: 'Cerebras',
    packageName: '@ai-sdk/cerebras',
    models: ['llama3.3-70b', 'gpt-oss-120b', 'qwen-3-32b'],
  }),
  aiSdk({
    id: 'claude-aws',
    name: 'Claude Platform on AWS',
    packageName: '@ai-sdk/amazon-bedrock',
    models: ['anthropic.claude-sonnet-4-5'],
  }),
  aiSdk({
    id: 'cohere',
    name: 'Cohere',
    packageName: '@ai-sdk/cohere',
    models: ['command-r-plus', 'command-r', 'command-a-03-2025'],
  }),
  aiSdk({
    id: 'deepgram',
    name: 'Deepgram',
    packageName: '@ai-sdk/deepgram',
    models: ['nova-2'],
  }),
  aiSdk({
    id: 'deepinfra',
    name: 'DeepInfra',
    packageName: '@ai-sdk/deepinfra',
    defaultBaseUrl: 'https://api.deepinfra.com/v1/openai',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct',
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
    ],
  }),
  aiSdk({
    id: 'deepseek',
    name: 'DeepSeek',
    packageName: '@ai-sdk/deepseek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  }),
]
