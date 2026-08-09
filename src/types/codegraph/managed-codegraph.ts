import type { McpStdioServer } from '@/types/pyrola/mcp-config'

/** Reserved MCP server id for first-party internal CodeGraph (not user config). */
export const CODEGRAPH_SERVER_ID = 'codegraph'

/** True for pyrola-owned MCP runtimes that must not appear in user MCP config/UI. */
export const isInternalMcpServer = (serverId: string): boolean =>
  serverId === CODEGRAPH_SERVER_ID

export const CODEGRAPH_NPM_PACKAGE = '@colbymchenry/codegraph'

export const CODEGRAPH_DIR_NAME = '.codegraph'

export const CODEGRAPH_DB_NAME = 'codegraph.db'

export const CODEGRAPH_MCP_TOOLS =
  'explore,node,search,callers,callees,impact,files,status'

/** In-memory MCP stdio config for the internal CodeGraph process. */
export const buildCodegraphServer = (projectRoot: string): McpStdioServer => ({
  command: 'npx',
  args: [
    '-y',
    CODEGRAPH_NPM_PACKAGE,
    'serve',
    '--mcp',
    '--path',
    projectRoot,
  ],
  env: {
    CODEGRAPH_TELEMETRY: '0',
    CODEGRAPH_NO_UPDATE_CHECK: '1',
    CODEGRAPH_MCP_TOOLS,
    NPM_CONFIG_LOGLEVEL: 'error',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  },
  enabled: true,
})

export const codegraphDbPath = (projectRoot: string): string => {
  const root = projectRoot.endsWith('/') ? projectRoot.slice(0, -1) : projectRoot
  return `${root}/${CODEGRAPH_DIR_NAME}/${CODEGRAPH_DB_NAME}`
}
