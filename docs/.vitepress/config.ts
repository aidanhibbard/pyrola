import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'pyrola',
  description: 'Local-first BYOK Agents UI',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/what-is-pyrola' },
      { text: 'Settings', link: '/settings/overview' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Compare', link: '/compare/agents-uis' },
      { text: 'FAQ', link: '/faq' },
      { text: 'GitHub', link: 'https://github.com/aidanhibbard/pyrola' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'What is Pyrola?', link: '/guide/what-is-pyrola' },
          { text: 'Install', link: '/guide/install' },
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Agents UI', link: '/guide/agents-ui' },
          { text: 'Modes', link: '/guide/modes' },
          { text: 'Fleet and projects', link: '/guide/fleet-and-projects' },
          { text: 'Workbench', link: '/guide/workbench' },
          { text: 'Plans and Studio', link: '/guide/plans-and-studio' },
          { text: 'Providers and BYOK', link: '/guide/providers-and-byok' },
          { text: 'MCP', link: '/guide/mcp' },
          { text: 'CLI', link: '/guide/cli' },
          { text: 'Security', link: '/guide/security' },
        ],
      },
      {
        text: 'Settings',
        items: [
          { text: 'Overview', link: '/settings/overview' },
          { text: 'General and Appearance', link: '/settings/general-and-appearance' },
          { text: 'Providers and Models', link: '/settings/providers-and-models' },
          { text: 'MCP and LSP', link: '/settings/mcp-and-lsp' },
          { text: 'Permissions', link: '/settings/permissions' },
          {
            text: 'Plans, Studio, Skills, Agents, Rules',
            link: '/settings/plans-studio-skills-agents-rules',
          },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Overview', link: '/architecture/overview' },
          { text: 'Harness', link: '/architecture/harness' },
          { text: 'Data and config', link: '/architecture/data-and-config' },
          { text: 'Desktop shell', link: '/architecture/desktop-shell' },
        ],
      },
      {
        text: 'Compare',
        items: [{ text: 'Agents UIs', link: '/compare/agents-uis' }],
      },
      {
        text: 'FAQ',
        items: [{ text: 'FAQ', link: '/faq' }],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/aidanhibbard/pyrola' },
    ],
  },
})
