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
      },
      {
        id: 'aidanhibbard-blog-mdx',
        title: 'Blog MDX pipeline',
      },
      {
        id: 'aidanhibbard-resume-pdf',
        title: 'Resume PDF export',
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
      },
      {
        id: 'nuxt-processor-devtools',
        title: 'Devtools integration',
      },
      {
        id: 'nuxt-processor-release',
        title: 'v0.4 release checklist',
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
      },
      {
        id: 'nitro-processor-edge-deploy',
        title: 'Edge deploy targets',
      },
      {
        id: 'nitro-processor-storage',
        title: 'Storage driver benchmarks',
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
