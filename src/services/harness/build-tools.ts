import { tool } from 'ai'
import { z } from 'zod'
import gitRepoInfo from '@/services/git/git-repo-info'
import {
  fsApplyPatch,
  fsEditFile,
  fsListDir,
  fsReadFile,
  fsStagePreviewApplyPatch,
  fsStagePreviewEdit,
  fsStagePreviewWrite,
  fsWriteFile,
  gitDiff,
  gitLog,
  gitStatus,
  httpProxyRequest,
  lspEnsureServer,
  lspRequest,
  mcpCallTool,
  mcpStatus,
  readMcpConfig,
  workspaceGlob,
  workspaceGrep,
} from '@/services/pyrola/pyrola-tauri'
import type { FileDiffRecord } from '@/services/pyrola/pyrola-tauri'
import type { FileDiff } from '@/types/harness/file-diff'
import {
  requestApproval,
  shouldAutoApprove,
} from '@/services/harness/approval-gate'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers } from '@/services/mcp/merge-mcp-config'
import createPlan from '@/services/plans/write-plan'
import parsePlan from '@/services/plans/parse-plan'
import { updatePlanTodos } from '@/services/plans/write-plan'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { PlanTodoItem } from '@/types/workbench/workbench-tab'
import {
  createAgentShell,
  getAgentShell,
  killAgentShell,
  tailShellOutput,
  waitForShellExit,
} from '@/services/harness/agent-shell-registry'
import type { HarnessEvent } from '@/types/harness/harness-event'

export type HarnessToolContext = {
  projectRoot: string
  projectSlug: string
  chatId: string
  settings: PyrolaSettings
  onPendingApproval: (toolCallId: string, name: string, diff: FileDiff[]) => void
  onHarnessEvent?: (event: HarnessEvent) => void
  signal?: AbortSignal
}

const mapDiffs = (raw: FileDiffRecord[]): FileDiff[] =>
  raw.map((item) => ({
    path: item.path,
    operation: item.operation as FileDiff['operation'],
    oldContent: item.oldContent,
    newContent: item.newContent,
    hunks: item.hunks.map((hunk) => ({
      oldStart: hunk.oldStart,
      newStart: hunk.newStart,
      lines: hunk.lines.map((line) => ({
        kind: line.kind as FileDiff['hunks'][number]['lines'][number]['kind'],
        content: line.content,
      })),
    })),
  }))

const DEFAULT_BLOCKING_TIMEOUT_MS = 120_000

const runTerminalCommand = async (
  ctx: HarnessToolContext,
  args: {
    command: string
    is_background?: boolean
    timeout_ms?: number
    description?: string
  },
): Promise<Record<string, unknown>> => {
  if (ctx.signal?.aborted) {
    throw new Error('Command aborted')
  }

  const shell = await createAgentShell({
    chatId: ctx.chatId,
    projectRoot: ctx.projectRoot,
    command: args.command,
  })

  if (args.is_background) {
    return {
      shellId: shell.shellId,
      status: 'running',
      command: args.command,
      description: args.description ?? null,
    }
  }

  const timeoutMs = args.timeout_ms ?? DEFAULT_BLOCKING_TIMEOUT_MS
  const waitResult = await waitForShellExit(shell.shellId, timeoutMs)
  const current = getAgentShell(shell.shellId)
  const stdout = current?.stdout ?? ''
  const stderr = current?.stderr ?? ''

  if (waitResult.timedOut) {
    await killAgentShell(shell.shellId)
    throw new Error(`Command timed out after ${timeoutMs}ms: ${args.command}`)
  }

  if (waitResult.exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim() || `exit code ${waitResult.exitCode}`
    throw new Error(`Command failed (${waitResult.exitCode}): ${detail}`)
  }

  return {
    shellId: shell.shellId,
    command: args.command,
    stdout,
    stderr,
    exitCode: waitResult.exitCode,
    timedOut: false,
    description: args.description ?? null,
  }
}

const readTerminalOutput = async (
  shellId: string,
  block?: boolean,
  tail?: number,
): Promise<Record<string, unknown>> => {
  const shell = getAgentShell(shellId)
  if (!shell) {
    throw new Error(`Shell not found: ${shellId}`)
  }

  if (block && shell.status === 'running') {
    await waitForShellExit(shellId, DEFAULT_BLOCKING_TIMEOUT_MS)
  }

  const current = getAgentShell(shellId)
  if (!current) {
    throw new Error(`Shell not found: ${shellId}`)
  }

  const output = tailShellOutput(current, tail)

  return {
    shellId,
    status: current.status,
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: current.exitCode,
  }
}

export default (ctx: HarnessToolContext) => ({
  read_file: tool({
    description: 'Read a file from the workspace',
    inputSchema: z.object({
      path: z.string(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    }),
    execute: async ({ path, offset, limit }) =>
      fsReadFile({ projectRoot: ctx.projectRoot, path, offset, limit }),
  }),
  list_dir: tool({
    description: 'List a directory',
    inputSchema: z.object({ path: z.string().default('.') }),
    execute: async ({ path }) => fsListDir(ctx.projectRoot, path),
  }),
  grep: tool({
    description: 'Search workspace with ripgrep',
    inputSchema: z.object({
      pattern: z.string(),
      glob: z.string().optional(),
    }),
    execute: async ({ pattern, glob }) =>
      workspaceGrep({ projectRoot: ctx.projectRoot, pattern, glob }),
  }),
  glob_files: tool({
    description: 'Glob files in workspace',
    inputSchema: z.object({ pattern: z.string() }),
    execute: async ({ pattern }) => workspaceGlob(ctx.projectRoot, pattern),
  }),
  git_status: tool({
    description: 'Git status',
    inputSchema: z.object({}),
    execute: async () => gitStatus(ctx.projectRoot),
  }),
  git_diff: tool({
    description: 'Git diff',
    inputSchema: z.object({ path: z.string().optional() }),
    execute: async ({ path }) => gitDiff({ projectRoot: ctx.projectRoot, path }),
  }),
  git_log: tool({
    description: 'Git log',
    inputSchema: z.object({ limit: z.number().optional() }),
    execute: async ({ limit }) => gitLog(ctx.projectRoot, limit),
  }),
  git_branch: tool({
    description: 'Current git branch',
    inputSchema: z.object({}),
    execute: async () => gitRepoInfo(ctx.projectRoot),
  }),
  write_file: tool({
    description: 'Write a file (requires approval)',
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path, content }, { toolCallId }) => {
      const diffs = mapDiffs(
        await fsStagePreviewWrite({ projectRoot: ctx.projectRoot, path, content }),
      )
      const auto = shouldAutoApprove(
        [path],
        ctx.settings['agent.autoApproveGlobs'] ?? [],
      )
      if (!auto) {
        ctx.onPendingApproval(toolCallId, 'write_file', diffs)
        const approved = await requestApproval(toolCallId, 'write_file', diffs)
        if (!approved) {
          return { rejected: true }
        }
      }
      await fsWriteFile({ projectRoot: ctx.projectRoot, path, content })
      return { ok: true, path }
    },
  }),
  edit_file: tool({
    description: 'Edit a file with exact string replacement',
    inputSchema: z.object({
      path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
    }),
    execute: async ({ path, old_string, new_string }, { toolCallId }) => {
      const replacements = [{ oldString: old_string, newString: new_string }]
      const diffs = mapDiffs(
        await fsStagePreviewEdit({
          projectRoot: ctx.projectRoot,
          path,
          replacements,
        }),
      )
      const auto = shouldAutoApprove(
        [path],
        ctx.settings['agent.autoApproveGlobs'] ?? [],
      )
      if (!auto) {
        ctx.onPendingApproval(toolCallId, 'edit_file', diffs)
        const approved = await requestApproval(toolCallId, 'edit_file', diffs)
        if (!approved) {
          return { rejected: true }
        }
      }
      await fsEditFile({
        projectRoot: ctx.projectRoot,
        path,
        replacements,
      })
      return { ok: true, path }
    },
  }),
  apply_patch: tool({
    description:
      'Apply an OpenCode-style patch (NOT git diff). Use headers like *** Update File: path/to/file.ts with +/- hunks.',
    inputSchema: z.object({ patch: z.string() }),
    execute: async ({ patch }, { toolCallId }) => {
      const diffs = mapDiffs(
        await fsStagePreviewApplyPatch({ projectRoot: ctx.projectRoot, patch }),
      )
      const paths = diffs.map((diff) => diff.path)
      const auto = shouldAutoApprove(
        paths.length > 0 ? paths : ['**'],
        ctx.settings['agent.autoApproveGlobs'] ?? [],
      )
      if (!auto) {
        ctx.onPendingApproval(toolCallId, 'apply_patch', diffs)
        const approved = await requestApproval(toolCallId, 'apply_patch', diffs)
        if (!approved) {
          return { rejected: true }
        }
      }
      await fsApplyPatch({ projectRoot: ctx.projectRoot, patch })
      return { ok: true, paths }
    },
  }),
  call_mcp_tool: tool({
    description: 'Call an MCP tool on a running server',
    inputSchema: z.object({
      serverId: z.string(),
      tool: z.string(),
      args: z.record(z.unknown()).default({}),
    }),
    execute: async ({ serverId, tool: toolName, args }) =>
      mcpCallTool(serverId, toolName, args as Record<string, unknown>),
  }),
  get_mcp_tools: tool({
    description:
      'List configured MCP servers and their available tools. Call this before call_mcp_tool when unsure what MCP capabilities exist.',
    inputSchema: z.object({}),
    execute: async () => {
      const personal = migrateMcpConfig(await readMcpConfig('personal', null))
      const projectRaw = await readMcpConfig('project', ctx.projectRoot).catch(() => null)
      const project = projectRaw ? migrateMcpConfig(projectRaw) : null
      const servers = listEffectiveMcpServers(personal, project)

      const catalog = await Promise.all(
        servers.map(async (server) => {
          try {
            const state = await mcpStatus(server.id)
            return {
              serverId: server.id,
              scope: server.scope,
              status: state.status,
              error: state.error ?? null,
              tools: state.tools.map((item) => ({
                name: item.name,
                description: item.description ?? '',
              })),
            }
          } catch (error) {
            return {
              serverId: server.id,
              scope: server.scope,
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
              tools: [],
            }
          }
        }),
      )

      return { servers: catalog }
    },
  }),
  ask_user: tool({
    description: 'Ask the user a clarifying question',
    inputSchema: z.object({
      question: z.string(),
      options: z.array(z.string()).optional(),
    }),
    execute: async ({ question, options }) => ({ question, options, pending: true }),
  }),
  web_search: tool({
    description: 'Search the web (BYOK)',
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => ({
      query,
      results: [],
      configured: false,
      note: 'Configure search provider in settings',
    }),
  }),
  load_skill: tool({
    description: 'Load a skill by name',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => ({ name, loaded: true }),
  }),
  spawn_subagent: tool({
    description: 'Spawn a blocking subagent',
    inputSchema: z.object({
      agentName: z.string(),
      prompt: z.string(),
      blocking: z.boolean().default(true),
    }),
    execute: async ({ agentName }): Promise<{ error: true }> => {
      throw new Error(`spawn_subagent is not implemented yet (${agentName})`)
    },
  }),
  create_plan: tool({
    description: 'Create a plan file',
    inputSchema: z.object({ title: z.string(), body: z.string() }),
    execute: async ({ title, body }) => {
      const plan = createPlan({ title, body, sourceChatId: ctx.chatId })
      await fsWriteFile({ projectRoot: ctx.projectRoot, path: plan.path, content: plan.content })
      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      if (projectId) {
        workbench.openPlan(projectId, plan.planId, plan.path, title)
      }
      return { planId: plan.planId, path: plan.path }
    },
  }),
  update_plan_todo: tool({
    description: 'Update plan todos',
    inputSchema: z.object({
      planPath: z.string(),
      todos: z.array(
        z.object({
          id: z.string(),
          content: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
        }),
      ),
    }),
    execute: async ({ planPath, todos }) => {
      const existing = await fsReadFile({ projectRoot: ctx.projectRoot, path: planPath })
      const parsed = parsePlan(existing.content)
      const nextContent = updatePlanTodos(existing.content, todos as PlanTodoItem[])
      await fsWriteFile({ projectRoot: ctx.projectRoot, path: planPath, content: nextContent })
      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      if (projectId) {
        workbench.openPlan(projectId, parsed.frontmatter.id, planPath, parsed.frontmatter.title)
        workbench.refreshPlanStudioTabs()
      }
      return { planPath, todos }
    },
  }),
  write_studio_artifact: tool({
    description: 'Write a studio artifact',
    inputSchema: z.object({ slug: z.string(), content: z.string() }),
    execute: async ({ slug, content }) => {
      const path = `.pyrola/studio/${slug}/index.md`
      await fsWriteFile({ projectRoot: ctx.projectRoot, path, content })
      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      if (projectId) {
        workbench.openStudio(projectId, slug, path, slug)
      }
      return { slug, path }
    },
  }),
  run_terminal: tool({
    description:
      'Run a shell command on the user machine (project cwd). Use for system reports, profiling, benchmarks, process/memory inspection, dev servers, and local agent monitoring — not only repo tasks. Default is blocking until exit. For long-running sampling (memory over a minute, log tailing, npm run dev), set is_background to true and poll with terminal_output. Append | cat for pagers. Do not use for file edits.',
    inputSchema: z.object({
      command: z.string(),
      is_background: z.boolean().optional(),
      timeout_ms: z.number().optional(),
      description: z.string().optional(),
    }),
    execute: async ({ command, is_background, timeout_ms, description }) =>
      runTerminalCommand(ctx, {
        command,
        is_background,
        timeout_ms,
        description,
      }),
  }),
  terminal_output: tool({
    description:
      'Read stdout/stderr from a background agent shell by shell_id. Use block true to wait until the shell exits.',
    inputSchema: z.object({
      shell_id: z.string(),
      block: z.boolean().optional(),
      tail: z.number().optional(),
    }),
    execute: async ({ shell_id, block, tail }) => readTerminalOutput(shell_id, block, tail),
  }),
  stop_terminal: tool({
    description: 'Stop a background agent shell by shell_id.',
    inputSchema: z.object({
      shell_id: z.string(),
    }),
    execute: async ({ shell_id }) => {
      const shell = await killAgentShell(shell_id)
      return {
        shellId: shell.shellId,
        exitCode: shell.exitCode,
      }
    },
  }),
  lsp: tool({
    description: 'LSP query (goToDefinition, hover, findReferences, symbols)',
    inputSchema: z.object({
      method: z.string(),
      path: z.string(),
      extension: z.string().optional(),
      params: z.record(z.unknown()).optional(),
    }),
    execute: async ({ method, path, extension, params }) => {
      const ext = extension ?? path.split('.').pop() ?? ''
      const server = await lspEnsureServer(ext).catch(() => null)
      if (!server?.running) {
        return { method, path, result: null, error: server?.error ?? 'LSP unavailable' }
      }
      const result = await lspRequest(server.id, method, {
        path,
        ...params,
      }).catch(() => null)
      return { method, path, result }
    },
  }),
  web_fetch: tool({
    description: 'Fetch a URL via the HTTP proxy',
    inputSchema: z.object({ url: z.string() }),
    execute: async ({ url }) => {
      const response = await httpProxyRequest({ url, method: 'GET' })
      return { url, status: response.status, body: response.body }
    },
  }),
})
