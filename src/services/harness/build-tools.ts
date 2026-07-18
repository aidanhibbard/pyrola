import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import createModel from '@/services/providers/create-model'
import { resolveParsedModelForRole } from '@/services/models/resolve-model-for-role'
import gitRepoInfo from '@/services/git/git-repo-info'
import {
  fsApplyPatch,
  fsDelete,
  fsEditFile,
  fsListDir,
  fsMove,
  fsReadFile,
  fsStagePreviewApplyPatch,
  fsStagePreviewDelete,
  fsStagePreviewEdit,
  fsStagePreviewWrite,
  fsWriteFile,
  gitBranchCreate,
  gitCheckoutBranch,
  gitCommit,
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
import { planTodoItemSchema } from '@/schemas/plan-document'
import {
  createAgentShell,
  getAgentShell,
  killAgentShell,
  tailShellOutput,
  waitForShellExit,
} from '@/services/harness/agent-shell-registry'
import { loadSkill } from '@/services/skills/skill-registry'
import isStudioHtmlContent from '@/services/studio/is-studio-html-content'
import parseStudioArtifact from '@/services/studio/parse-studio-artifact'
import validateStudioBlocks from '@/services/studio/validate-studio-blocks'
import validateStudioSlug from '@/services/studio/validate-studio-slug'
import studioDataSchema from '@/schemas/studio/studio-data'
import type { HarnessEvent } from '@/types/harness/harness-event'
import { requestQuestion } from '@/services/harness/question-gate'
import webSearch from '@/services/web/web-search'
import {
  fail as failSubagent,
  register as registerSubagent,
  resolve as resolveSubagent,
} from '@/services/harness/subagent-registry'

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
const SUBAGENT_MAX_OUTPUT_TOKENS = 8192
const SUBAGENT_MAX_STEPS = 15

const LSP_DIAGNOSTICS_METHODS = new Set([
  'diagnostics',
  'publishDiagnostics',
  'textDocument/diagnostic',
])

const parseLspDiagnosticItems = (result: unknown): unknown[] => {
  if (Array.isArray(result)) {
    return result
  }
  if (!result || typeof result !== 'object') {
    return []
  }
  const payload = result as Record<string, unknown>
  if (Array.isArray(payload.items)) {
    return payload.items
  }
  if (Array.isArray(payload.diagnostics)) {
    return payload.diagnostics
  }
  return []
}

const SUBAGENT_READ_ONLY_TOOLS = [
  'read_file',
  'list_dir',
  'grep',
  'glob_files',
  'git_status',
  'git_diff',
  'git_log',
  'git_branch',
  'lsp',
  'diagnostics',
  'web_fetch',
  'web_search',
  'load_skill',
  'call_mcp_tool',
  'get_mcp_tools',
] as const

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

const buildHarnessTools = (ctx: HarnessToolContext) => ({
  read_file: tool({
    description:
      'Read a file from the workspace. For image files (.png, .jpg, .jpeg, .gif, .webp, .svg), returns image metadata and optional base64 instead of plain text.',
    inputSchema: z.object({
      path: z.string(),
      offset: z.number().optional(),
      limit: z.number().optional(),
      include_base64: z.boolean().optional(),
    }),
    execute: async ({ path, offset, limit, include_base64 }) => {
      const result = await fsReadFile({
        projectRoot: ctx.projectRoot,
        path,
        offset,
        limit,
        includeBase64: include_base64,
      })

      if (result.isImage) {
        return {
          path: result.path,
          isImage: true,
          mimeType: result.mimeType ?? null,
          sizeBytes: result.sizeBytes ?? null,
          content: result.content || null,
          base64: result.base64 ?? null,
        }
      }

      return result
    },
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
  git_checkout: tool({
    description: 'Checkout a git branch or ref',
    inputSchema: z.object({ branch: z.string() }),
    execute: async ({ branch }) => {
      await gitCheckoutBranch(ctx.projectRoot, branch)
      return { branch, checkedOut: true }
    },
  }),
  git_branch_create: tool({
    description: 'Create a new git branch',
    inputSchema: z.object({
      name: z.string(),
      checkout: z.boolean().optional(),
    }),
    execute: async ({ name, checkout }) => {
      await gitBranchCreate({
        projectRoot: ctx.projectRoot,
        name,
        checkout,
      })
      return { name, checkout: checkout ?? true }
    },
  }),
  git_commit: tool({
    description: 'Stage and commit changes with a message',
    inputSchema: z.object({
      message: z.string(),
      paths: z.array(z.string()).optional(),
    }),
    execute: async ({ message, paths }) =>
      gitCommit({
        projectRoot: ctx.projectRoot,
        message,
        paths,
      }),
  }),
  delete_file: tool({
    description: 'Delete a file from the workspace (requires approval)',
    inputSchema: z.object({
      path: z.string(),
      recursive: z.boolean().optional(),
    }),
    execute: async ({ path, recursive }, { toolCallId }) => {
      let diffs: FileDiff[]
      try {
        diffs = mapDiffs(
          await fsStagePreviewDelete({ projectRoot: ctx.projectRoot, path }),
        )
      } catch {
        diffs = [{ path, operation: 'delete', hunks: [] }]
      }

      const auto = shouldAutoApprove(
        [path],
        ctx.settings['agent.autoApproveGlobs'] ?? [],
      )
      if (!auto) {
        ctx.onPendingApproval(toolCallId, 'delete_file', diffs)
        const approved = await requestApproval(toolCallId, 'delete_file', diffs)
        if (!approved) {
          return { rejected: true }
        }
      }

      await fsDelete({ projectRoot: ctx.projectRoot, path, recursive })
      return { ok: true, path, diffs }
    },
  }),
  move_file: tool({
    description: 'Move or rename a workspace file (requires approval)',
    inputSchema: z.object({
      from: z.string(),
      to: z.string(),
    }),
    execute: async ({ from, to }, { toolCallId }) => {
      const diffs: FileDiff[] = [
        {
          path: from,
          operation: 'rename',
          newContent: to,
          hunks: [
            {
              oldStart: 1,
              newStart: 1,
              lines: [
                { kind: 'remove', content: from },
                { kind: 'add', content: to },
              ],
            },
          ],
        },
      ]

      const auto = shouldAutoApprove(
        [from, to],
        ctx.settings['agent.autoApproveGlobs'] ?? [],
      )
      if (!auto) {
        ctx.onPendingApproval(toolCallId, 'move_file', diffs)
        const approved = await requestApproval(toolCallId, 'move_file', diffs)
        if (!approved) {
          return { rejected: true }
        }
      }

      await fsMove({ projectRoot: ctx.projectRoot, from, to })
      return { ok: true, from, to, diffs }
    },
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
      return { ok: true, path, diffs }
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
      return { ok: true, path, diffs }
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
      return { ok: true, paths, diffs }
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
    execute: async ({ question, options }, { toolCallId }) => {
      if (ctx.signal?.aborted) {
        throw new Error('Question aborted')
      }
      ctx.onHarnessEvent?.({
        type: 'question-request',
        toolCallId,
        question,
        options,
      })
      const answer = await requestQuestion(toolCallId, question, options)
      if (ctx.signal?.aborted) {
        throw new Error('Question aborted')
      }
      return { question, answer, options }
    },
  }),
  load_skill: tool({
    description: 'Load the full instructions for a skill by name',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => {
      const result = await loadSkill(name, ctx.projectRoot)
      if ('error' in result) {
        return result
      }
      return {
        name: result.name,
        skillDirectory: result.skillDirectory,
        content: result.content,
        truncated: result.truncated,
      }
    },
  }),
  create_plan: tool({
    description: 'Create a plan file',
    inputSchema: z.object({
      title: z.string(),
      body: z.string(),
      todos: z.array(planTodoItemSchema).optional(),
    }),
    execute: async ({ title, body, todos }) => {
      const planTodos = todos ?? []
      const plan = createPlan({ title, body, todos: planTodos, sourceChatId: ctx.chatId })
      await fsWriteFile({ projectRoot: ctx.projectRoot, path: plan.path, content: plan.content })
      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      if (projectId) {
        workbench.openPlan(projectId, plan.planId, plan.path, title)
      }
      return { planId: plan.planId, path: plan.path, todos: planTodos }
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
      if (parsed.parseError) {
        throw new Error(parsed.parseError)
      }
      const nextContent = updatePlanTodos(existing.content, todos)
      await fsWriteFile({ projectRoot: ctx.projectRoot, path: planPath, content: nextContent })
      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      if (projectId) {
        workbench.openPlan(projectId, parsed.frontmatter!.id, planPath, parsed.frontmatter!.title)
        workbench.refreshPlanStudioTabs()
      }
      return { planPath, todos }
    },
  }),
  write_studio_artifact: tool({
    description:
      'Publish a Comark studio artifact to .pyrola/studio/<slug>/index.md. Load skill studio first. Optional data sidecar writes data.json.',
    inputSchema: z.object({
      slug: z.string(),
      content: z.string(),
      data: z.record(z.unknown()).optional(),
    }),
    execute: async ({ slug, content, data: sidecar }) => {
      const slugError = validateStudioSlug(slug)
      if (slugError) {
        return { error: slugError }
      }
      if (isStudioHtmlContent(content)) {
        return {
          error:
            'Studio artifacts must be Comark markdown, not HTML. Call load_skill("studio") for block syntax.',
        }
      }

      const parsed = parseStudioArtifact(content)
      if (parsed.parseError) {
        return { error: parsed.parseError }
      }

      const blockError = await validateStudioBlocks(parsed.body)
      if (blockError) {
        return { error: blockError }
      }

      if (sidecar) {
        const dataResult = studioDataSchema.safeParse(sidecar)
        if (!dataResult.success) {
          return { error: 'Invalid studio data sidecar: expected a JSON object' }
        }
      }

      const path = `.pyrola/studio/${slug}/index.md`
      await fsWriteFile({ projectRoot: ctx.projectRoot, path, content })
      if (sidecar) {
        await fsWriteFile({
          projectRoot: ctx.projectRoot,
          path: `.pyrola/studio/${slug}/data.json`,
          content: `${JSON.stringify(sidecar, null, 2)}\n`,
        })
      }

      const workbench = useWorkbenchStore()
      const projectId = workbench.resolveProjectIdByRoot(ctx.projectRoot)
      const parsedTitle = content.match(/^---[\s\S]*?title:\s*(.+)$/m)?.[1]?.trim()
      if (projectId) {
        workbench.openStudio(projectId, slug, path, parsedTitle ?? slug)
      }
      return {
        slug,
        path,
        dataPath: sidecar ? `.pyrola/studio/${slug}/data.json` : null,
      }
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
    description:
      'LSP query (goToDefinition, hover, findReferences, symbols, diagnostics)',
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
      if (LSP_DIAGNOSTICS_METHODS.has(method)) {
        return { method, path, diagnostics: parseLspDiagnosticItems(result), result }
      }
      return { method, path, result }
    },
  }),
  diagnostics: tool({
    description: 'Read linter and diagnostic errors for a file',
    inputSchema: z.object({
      path: z.string(),
      extension: z.string().optional(),
    }),
    execute: async ({ path, extension }) => {
      const ext = extension ?? path.split('.').pop() ?? ''
      const server = await lspEnsureServer(ext).catch(() => null)
      if (!server?.running) {
        return { path, diagnostics: [], error: server?.error ?? 'LSP unavailable' }
      }

      const result = await lspRequest(server.id, 'diagnostics', { path }).catch(
        (error: unknown) => ({
          error: error instanceof Error ? error.message : 'Diagnostics request failed',
        }),
      )

      if (result && typeof result === 'object' && 'error' in result) {
        return {
          path,
          diagnostics: [],
          error: String((result as { error: string }).error),
        }
      }

      return { path, diagnostics: parseLspDiagnosticItems(result) }
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
  web_search: tool({
    description: 'Search the web for real-time information',
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().optional(),
    }),
    execute: async ({ query, limit }) => webSearch(query, limit),
  }),
})

const runSubagentGenerate = async (args: {
  ctx: HarnessToolContext
  subagentId: string
  agentName: string
  prompt: string
  toolCallId: string
  signal: AbortSignal
}): Promise<string> => {
  const { ctx, subagentId, agentName, prompt, toolCallId, signal } = args

  const modelRef = resolveParsedModelForRole('agent', ctx.settings)
  if (!modelRef) {
    throw new Error('No model configured for agent role')
  }

  const model = await createModel({
    providerId: modelRef.providerId,
    modelId: modelRef.modelId,
    settings: ctx.settings,
  })

  const emitNestedEvent = (event: HarnessEvent): void => {
    ctx.onHarnessEvent?.({
      type: 'subagent-event',
      parentToolCallId: toolCallId,
      event,
    })
  }

  const nestedCtx: HarnessToolContext = {
    ...ctx,
    onHarnessEvent: emitNestedEvent,
    signal,
  }
  const allow = new Set<string>(SUBAGENT_READ_ONLY_TOOLS)
  const nestedTools = Object.fromEntries(
    Object.entries(buildHarnessTools(nestedCtx)).filter(([name]) => allow.has(name)),
  )

  if (signal.aborted) {
    throw new Error('Subagent aborted')
  }

  const result = await generateText({
    model,
    system: `You are a read-only sub-agent named "${agentName}". Explore the codebase with read-only tools. Do not modify files or run commands. Provide a concise summary when finished.`,
    prompt,
    tools: nestedTools,
    stopWhen: stepCountIs(SUBAGENT_MAX_STEPS),
    maxOutputTokens: SUBAGENT_MAX_OUTPUT_TOKENS,
    abortSignal: signal,
    onToolExecutionStart: (event) => {
      emitNestedEvent({
        type: 'tool-start',
        toolCallId: event.toolCall.toolCallId,
        name: event.toolCall.toolName,
        args: event.toolCall.input,
      })
    },
    onToolExecutionEnd: (event) => {
      const { toolCall, toolOutput } = event
      if (toolOutput.type === 'tool-error') {
        emitNestedEvent({
          type: 'tool-result',
          toolCallId: toolCall.toolCallId,
          result: { error: toolOutput.error },
          isError: true,
        })
        return
      }
      emitNestedEvent({
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        result: toolOutput.output,
        isError: false,
      })
    },
  })

  if (signal.aborted) {
    throw new Error('Subagent aborted')
  }

  return result.text
}

const buildTools = (ctx: HarnessToolContext) => ({
  ...buildHarnessTools(ctx),
  spawn_subagent: tool({
    description:
      'Spawn a subagent. Default is blocking until complete. Set blocking to false to run in the background and continue the parent turn; the harness resumes when the subagent finishes.',
    inputSchema: z.object({
      agentName: z.string(),
      prompt: z.string(),
      blocking: z.boolean().default(true),
    }),
    execute: async (
      { agentName, prompt, blocking },
      { toolCallId },
    ): Promise<
      | { subagentId: string; name: string; summary: string }
      | { subagentId: string; status: 'running' }
    > => {
      if (ctx.signal?.aborted) {
        throw new Error('Subagent aborted')
      }

      const subagentId = crypto.randomUUID()

      ctx.onHarnessEvent?.({
        type: 'subagent-start',
        subagentId,
        name: agentName,
        blocking,
      })

      if (!blocking) {
        const controller = new AbortController()
        ctx.signal?.addEventListener('abort', () => controller.abort(), { once: true })

        registerSubagent(ctx.chatId, subagentId, controller, {
          toolCallId,
          agentName,
        })

        ctx.onHarnessEvent?.({
          type: 'pending-subagent',
          toolCallId,
          subagentId,
          agentName,
          prompt,
        })

        const completeSubagent = async (): Promise<void> => {
          try {
            const summary = await runSubagentGenerate({
              ctx,
              subagentId,
              agentName,
              prompt,
              toolCallId,
              signal: controller.signal,
            })

            resolveSubagent(subagentId, { subagentId, name: agentName, summary })
            ctx.onHarnessEvent?.({
              type: 'subagent-result',
              subagentId,
              summary,
              blocking: false,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Subagent failed'
            failSubagent(subagentId, message)
            ctx.onHarnessEvent?.({
              type: 'subagent-result',
              subagentId,
              summary: message,
              blocking: false,
            })
          }
        }

        void completeSubagent()

        return { subagentId, status: 'running' }
      }

      try {
        const summary = await runSubagentGenerate({
          ctx,
          subagentId,
          agentName,
          prompt,
          toolCallId,
          signal: ctx.signal ?? new AbortController().signal,
        })

        ctx.onHarnessEvent?.({
          type: 'subagent-result',
          subagentId,
          summary,
          blocking: true,
        })

        return { subagentId, name: agentName, summary }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Subagent failed'
        ctx.onHarnessEvent?.({
          type: 'subagent-result',
          subagentId,
          summary: message,
          blocking: true,
        })
        throw error
      }
    },
  }),
})

export default buildTools
