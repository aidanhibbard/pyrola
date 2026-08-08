import { viteBundler } from '@vuepress/bundler-vite'
import { markdownChartPlugin } from '@vuepress/plugin-markdown-chart'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'

const guideChildren = [
  'what-is-pyrola.md',
  'install.md',
  'getting-started.md',
  'agents-ui.md',
  'modes.md',
  'fleet-and-projects.md',
  'workbench.md',
  'plans-and-studio.md',
  'providers-and-byok.md',
  'mcp.md',
  'cli.md',
  'security.md',
]

const settingsChildren = [
  'overview.md',
  'general-and-appearance.md',
  'providers-and-models.md',
  'mcp-and-lsp.md',
  'permissions.md',
  'plans-studio-skills-agents-rules.md',
]

const architectureChildren = [
  'overview.md',
  'harness.md',
  'data-and-config.md',
  'desktop-shell.md',
]

export default defineUserConfig({
  base: '/pyrola/',
  lang: 'en-US',
  title: 'pyrola',
  description: 'Local-first BYOK Agents UI',

  bundler: viteBundler(),

  theme: defaultTheme({
    repo: 'aidanhibbard/pyrola',
    docsDir: 'docs',
    docsBranch: 'main',
    editLink: true,
    lastUpdated: true,
    contributors: false,
    navbar: [
      { text: 'Guide', link: '/guide/what-is-pyrola.html' },
      { text: 'Settings', link: '/settings/overview.html' },
      { text: 'Architecture', link: '/architecture/overview.html' },
      { text: 'Compare', link: '/compare/agents-uis.html' },
      { text: 'FAQ', link: '/faq.html' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          children: guideChildren,
        },
      ],
      '/settings/': [
        {
          text: 'Settings',
          children: settingsChildren,
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          children: architectureChildren,
        },
      ],
      '/compare/': [
        {
          text: 'Compare',
          children: ['agents-uis.md'],
        },
      ],
      '/': [
        {
          text: 'FAQ',
          children: ['faq.md'],
        },
      ],
    },
  }),

  plugins: [
    markdownChartPlugin({
      mermaid: true,
    }),
  ],
})
