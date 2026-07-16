import type { FleetPinnedChat } from '@/types/fleet/fleet-pinned-chat'
import type { FleetSidebarProject } from '@/types/fleet/fleet-sidebar-project'

export const MOCK_FLEET_PROJECTS: FleetSidebarProject[] = [
  {
    slug: 'aidanhibbard',
    displayName: 'aidanhibbard',
    isActiveProject: true,
    defaultExpanded: true,
    chats: [
      {
        id: 'aidanhibbard-portfolio-refresh',
        title: 'Portfolio site refresh',
        updatedAtLabel: '3m',
      },
      {
        id: 'aidanhibbard-blog-mdx',
        title: 'Blog MDX pipeline',
        updatedAtLabel: '1h',
      },
      {
        id: 'aidanhibbard-resume-pdf',
        title: 'Resume PDF export',
        updatedAtLabel: '20h',
      },
    ],
  },
  {
    slug: 'nuxt-processor',
    displayName: 'nuxt-processor',
    defaultExpanded: false,
    chats: [
      {
        id: 'nuxt-processor-module-hooks',
        title: 'Module hooks refactor',
        updatedAtLabel: '2d',
      },
      {
        id: 'nuxt-processor-devtools',
        title: 'Devtools integration',
        updatedAtLabel: '4d',
      },
      {
        id: 'nuxt-processor-release',
        title: 'v0.4 release checklist',
        updatedAtLabel: '1w',
      },
    ],
  },
  {
    slug: 'nitro-processor',
    displayName: 'nitro-processor',
    defaultExpanded: false,
    chats: [
      {
        id: 'nitro-processor-preset-cache',
        title: 'Preset cache invalidation',
        updatedAtLabel: '1d',
      },
      {
        id: 'nitro-processor-edge-deploy',
        title: 'Edge deploy targets',
        updatedAtLabel: '3d',
      },
      {
        id: 'nitro-processor-storage',
        title: 'Storage driver benchmarks',
        updatedAtLabel: '5h',
      },
    ],
  },
]

export const MOCK_PINNED_CHATS: FleetPinnedChat[] = [
  {
    chatId: 'aidanhibbard-portfolio-refresh',
    title: 'Portfolio site refresh',
    projectSlug: 'aidanhibbard',
    projectLabel: 'aidanhibbard',
  },
  {
    chatId: 'nuxt-processor-module-hooks',
    title: 'Module hooks refactor',
    projectSlug: 'nuxt-processor',
    projectLabel: 'nuxt-processor',
  },
]
