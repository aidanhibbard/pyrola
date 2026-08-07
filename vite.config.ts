import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
// Object form (not a callback) so vitest mergeConfig can load this file.
const enableVueDevTools =
  process.env.NODE_ENV !== 'production' && process.env.VITEST !== 'true'

export default defineConfig({
  plugins: [
    vue(),
    ...(enableVueDevTools ? [vueDevTools()] : []),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/vscode-material-icons/generated/icons/*.svg',
          dest: 'file-icons',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  resolve: {
    alias: [
      {
        find: '@/components/ui',
        replacement: fileURLToPath(new URL('./src/components/shadcn/ui', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  // https://v2.tauri.app/start/create-project/#manual-setup-tauri-cli
  server: {
    watch: {
      // Project `.pyrola/` is runtime config (mcp.json, settings); writing it
      // must not trigger a Vite full reload / app reboot.
      ignored: ['**/src-tauri/**', '**/.pyrola/**'],
    },
  },
})
