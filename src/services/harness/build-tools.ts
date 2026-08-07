import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import createModel from '@/services/providers/create-model'
import resolveModelForRole, {
  resolveParsedModelForRole,
} from '@/services/models/resolve-model-for-role'
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  resolveModelCallOptions,
} from '@/services/models/resolve-model-call-options'
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
  gateToolPermission,
  type PermissionGateContext,
  type PendingApprovalView,
} from '@/services/harness/gate-tool-permission'
import {
  fsDeleteCapability,
  fsWriteCapability,
  mcpCapability,
} from '@/services/harness/permission-policy'
import type { PermissionCapabilityKey, PermissionLevel } from '@/types/harness/permission'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers } from '@/services/mcp/merge-mcp-config'
import { isMcpTrusted, sessionTrusts } from '@/services/mcp/mcp-trust'
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
import {
  fail as failSubagent,
  register as registerSubagent,
  resolve as resolveSubagent,
} from '@/services/harness/subagent-registry'
import fleetCounter from '@/services/harness/fleet-counter'
import buildBrowserTools from '@/services/harness/build-browser-tools'
import resolveModelVision from '@/services/harness/resolve-model-vision'
import withToolExamples from '@/services/harness/with-tool-examples'

export type HarnessToolContext = {
  projectRoot: string
  projectSlug: string
  chatId: string
  settings: PyrolaSettings
  permissionLevel: PermissionLevel
  sessionAllows: Set<string>
  sessionDenies: Set<string>
  sandboxEnabled: boolean
  supportsVision: boolean
  onPendingApproval: (entry: PendingApprovalView) => void
  persistPermission?: (
    capability: PermissionCapabilityKey,
    verdict: 'allow' | 'deny',
    scope: 'workspace' | 'always',
  ) => Promise<void>
  onHarnessEvent?: (event: HarnessEvent) => void
  signal?: AbortSignal
}

const toPermCtx = (ctx: HarnessToolContext): PermissionGateContext => ({
  settings: ctx.settings,
  permissionLevel: ctx.permissionLevel,
  sessionAllows: ctx.sessionAllows,
  sessionDenies: ctx.sessionDenies,
  sandboxEnabled: ctx.sandboxEnabled,
  onPendingApproval: ctx.onPendingApproval,
  persistPermission: ctx.persistPermission,
})

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
const SUBAGENT_MAX_OUTPUT_TOKENS = DEFAULT_MAX_OUTPUT_TOKENS
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
  'load_skill',
  'call_mcp_tool',
  'get_mcp_tools',
] as const

const isSandboxSpawnError = (message: string): boolean =>
  message.startsWith('SANDBOX_FAILED:')

const runTerminalCommand = async (
  ctx: HarnessToolContext,
  args: {
    command: string
    is_background?: boolean
    timeout_ms?: number
    description?: string
    sandboxed?: boolean
    allowNetwork?: boolean
  },
): Promise<Record<string, unknown>> => {
  if (ctx.signal?.aborted) {
    throw new Error('Command aborted')
  }

  const shell = await createAgentShell({
    chatId: ctx.chatId,
    projectRoot: ctx.projectRoot,
    command: args.command,
    sandboxed: args.sandboxed,
    allowNetwork: args.allowNetwork,
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
  ...buildBrowserTools(ctx),
  read_file: tool({
    description:
      'Read a file from the workspace. For image files (.png, .jpg, .jpeg, .gif, .webp, .svg), returns image metadata and optional base64 instead of plain text.',
    inputSchema: z.object({
      path: z.string().describe('Workspace-relative file path'),
      offset: z.number().optional().describe('1-based start line'),
      limit: z.number().optional().describe('Max lines to return'),
      include_base64: z.boolean().optional().describe('Include base64 for images'),
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
    inputSchema: z.object({
      path: z.string().default('.').describe('Workspace-relative directory path'),
    }),
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
    execute: async ({ branch }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'git_checkout',
        kind: 'git',
        action: 'git.write',
        capability: 'git.checkout',
        title: `git checkout ${branch}`,
      })
      if (!allowed) {
        return { rejected: true, error: 'Git checkout denied' }
      }
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
    execute: async ({ name, checkout }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'git_branch_create',
        kind: 'git',
        action: 'git.write',
        capability: 'git.branch_create',
        title: `git branch ${name}`,
      })
      if (!allowed) {
        return { rejected: true, error: 'Git branch create denied' }
      }
      await gitBranchCreate({
        projectRoot: ctx.projectRoot,
        name,
        checkout,
      })
      return { name, checkout: checkout ?? true }
    },
  }),
  git_commit: tool({
    description:
      'Stage specific paths and commit with a message. paths is required — use git_status to identify changed files before committing.',
    inputSchema: z.object({
      message: z.string(),
      paths: z.array(z.string()).min(1),
    }),
    execute: async ({ message, paths }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'git_commit',
        kind: 'git',
        action: 'git.write',
        capability: 'git.commit',
        title: `git commit: ${message}`,
      })
      if (!allowed) {
        return { rejected: true, error: 'Git commit denied' }
      }
      return gitCommit({
        projectRoot: ctx.projectRoot,
        message,
        paths,
      })
    },
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

      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'delete_file',
        kind: 'fs',
        action: 'fs.delete',
        capability: fsDeleteCapability(path),
        title: `Delete ${path}`,
        paths: [path],
        diff: diffs,
      })
      if (!allowed) {
        return { rejected: true, error: 'Delete not approved' }
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

      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'move_file',
        kind: 'fs',
        action: 'fs.write',
        capability: fsWriteCapability(to),
        title: `Move ${from} → ${to}`,
        paths: [from, to],
        diff: diffs,
      })
      if (!allowed) {
        return { rejected: true, error: 'Move not approved' }
      }

      await fsMove({ projectRoot: ctx.projectRoot, from, to })
      return { ok: true, from, to, diffs }
    },
  }),
  write_file: tool({
    description: withToolExamples('Create or overwrite a file (requires approval). Prefer edit_file for small changes.', [
      {
        path: 'src/utils/format-date.ts',
        content: "export default (value: Date): string => value.toISOString()\n",
      },
    ]),
    inputSchema: z.object({
      path: z.string().describe('Workspace-relative file path'),
      content: z.string().describe('Full file contents to write'),
    }),
    execute: async ({ path, content }, { toolCallId }) => {
      const diffs = mapDiffs(
        await fsStagePreviewWrite({ projectRoot: ctx.projectRoot, path, content }),
      )
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'write_file',
        kind: 'fs',
        action: 'fs.write',
        capability: fsWriteCapability(path),
        title: `Write ${path}`,
        paths: [path],
        diff: diffs,
      })
      if (!allowed) {
        return { rejected: true, error: 'Write not approved' }
      }
      await fsWriteFile({ projectRoot: ctx.projectRoot, path, content })
      return { ok: true, path, diffs }
    },
  }),
  edit_file: tool({
    description: withToolExamples(
      'Edit a file with exact string replacement. old_string must match the file uniquely.',
      [
        {
          path: 'src/services/harness/tool-catalog.ts',
          old_string: "edit_file: 'Edit a file with search/replace',",
          new_string: "edit_file: 'Edit a file with exact string replacement',",
        },
      ],
    ),
    inputSchema: z.object({
      path: z.string().describe('Workspace-relative file path'),
      old_string: z.string().describe('Exact text to find (must be unique in the file)'),
      new_string: z.string().describe('Replacement text'),
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
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'edit_file',
        kind: 'fs',
        action: 'fs.write',
        capability: fsWriteCapability(path),
        title: `Edit ${path}`,
        paths: [path],
        diff: diffs,
      })
      if (!allowed) {
        return { rejected: true, error: 'Edit not approved' }
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
    description: withToolExamples(
      'Apply an OpenCode-style patch (NOT git diff). Use headers like *** Update File: path/to/file.ts with +/- hunks.',
      [
        {
          patch:
            '*** Update File: src/utils/hello.ts\n@@\n-export const hello = () => "hi"\n+export const hello = () => "hello"\n',
        },
      ],
    ),
    inputSchema: z.object({
      patch: z.string().describe('OpenCode-style multi-file patch text'),
    }),
    execute: async ({ patch }, { toolCallId }) => {
      const diffs = mapDiffs(
        await fsStagePreviewApplyPatch({ projectRoot: ctx.projectRoot, patch }),
      )
      const paths = diffs.map((diff) => diff.path)
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'apply_patch',
        kind: 'fs',
        action: 'fs.write',
        capability: fsWriteCapability('*'),
        title: `Apply patch (${paths.length} file${paths.length !== 1 ? 's' : ''})`,
        paths: paths.length > 0 ? paths : ['**'],
        diff: diffs,
      })
      if (!allowed) {
        return { rejected: true, error: 'Patch not approved' }
      }
      await fsApplyPatch({ projectRoot: ctx.projectRoot, patch })
      return { ok: true, paths, diffs }
    },
  }),
  call_mcp_tool: tool({
    description: withToolExamples(
      'Call an MCP tool on a running trusted server. Use get_mcp_tools first for inputSchema and inputExamples.',
      [
        {
          serverId: 'nuxt-docs',
          tool: 'get-page',
          args: { path: '/getting-started/installation' },
        },
        {
          serverId: 'shadcn',
          tool: 'search_items_in_registries',
          args: { registries: ['@shadcn'], query: 'button' },
        },
      ],
    ),
    inputSchema: z.object({
      serverId: z.string().describe('MCP server id from config / get_mcp_tools'),
      tool: z.string().describe('Tool name from that server'),
      args: z
        .record(z.unknown())
        .default({})
        .describe('Arguments matching the tool inputSchema'),
    }),
    execute: async ({ serverId, tool: toolName, args }, { toolCallId }) => {
      if (!isMcpTrusted(ctx.settings, serverId, sessionTrusts)) {
        return {
          error: `MCP server "${serverId}" has not been granted trust. Open Settings → MCP and start the server to grant trust before the agent can call its tools.`,
        }
      }
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'call_mcp_tool',
        kind: 'mcp',
        action: 'mcp.call',
        capability: mcpCapability(serverId, toolName),
        title: `${serverId}/${toolName}`,
      })
      if (!allowed) {
        return { rejected: true, error: 'MCP call denied' }
      }
      return mcpCallTool(serverId, toolName, args as Record<string, unknown>)
    },
  }),
  get_mcp_tools: tool({
    description:
      'List configured MCP servers and their tools (name, description, inputSchema, inputExamples). Call before call_mcp_tool when unsure. No arguments.',
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
              tools: state.tools.map((item) => {
                const meta = item.meta ?? null
                const inputExamples =
                  meta &&
                  typeof meta === 'object' &&
                  'inputExamples' in meta
                    ? meta.inputExamples
                    : null
                return {
                  name: item.name,
                  description: item.description ?? '',
                  inputSchema: item.inputSchema ?? null,
                  inputExamples: inputExamples ?? null,
                }
              }),
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
    description: withToolExamples('Create a plan file under .pyrola/plans/.', [
      {
        title: 'Add harness tool examples',
        body: '## Goal\nSurface usage examples on high-friction tools.\n',
        todos: [
          { id: 'helper', content: 'Add with-tool-examples helper', status: 'pending' },
        ],
      },
    ]),
    inputSchema: z.object({
      title: z.string().describe('Plan title'),
      body: z.string().describe('Markdown plan body'),
      todos: z.array(planTodoItemSchema).optional().describe('Initial todo items'),
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
    description: withToolExamples('Replace the todos array in an existing plan file.', [
      {
        planPath: '.pyrola/plans/harness-tool-examples-2026-08-06-221900/PLAN.md',
        todos: [
          {
            id: 'helper',
            content: 'Add with-tool-examples helper',
            status: 'completed',
          },
          {
            id: 'builtin-examples',
            content: 'Add examples to high-friction tools',
            status: 'in_progress',
          },
        ],
      },
    ]),
    inputSchema: z.object({
      planPath: z.string().describe('Path to PLAN.md'),
      todos: z.array(
        z.object({
          id: z.string().describe('Stable todo id'),
          content: z.string().describe('Todo text'),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'cancelled'])
            .describe('Todo status'),
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
    description: withToolExamples(
      'Publish a Comark studio artifact to .pyrola/studio/<slug>/index.md. Load skill studio first. Optional data sidecar writes data.json. Never use HTML.',
      [
        {
          slug: 'launch-brief',
          content:
            '---\ntitle: Launch brief\n---\n\n# Launch brief\n\nShort prose artifact.\n',
        },
        {
          slug: 'metrics-dashboard',
          content:
            '---\ntitle: Metrics\n---\n\n# Metrics\n\n```table\n| Metric | Value |\n| --- | --- |\n| Users | 1200 |\n```\n',
          data: { users: 1200 },
        },
      ],
    ),
    inputSchema: z.object({
      slug: z.string().describe('URL-safe studio slug'),
      content: z.string().describe('Comark markdown with optional frontmatter'),
      data: z.record(z.unknown()).optional().describe('Optional data.json sidecar object'),
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
    description: withToolExamples(
      'Run a shell command on the user machine (project cwd). Use for system reports, profiling, benchmarks, process/memory inspection, dev servers, and local agent monitoring, not only repo tasks. Default is blocking until exit. For long-running sampling (memory over a minute, log tailing, npm run dev), set is_background to true and poll with terminal_output. Append | cat for pagers. Do not use for file edits.',
      [
        {
          command: 'git status --short',
          description: 'Working tree status',
        },
        {
          command: 'npm run dev',
          is_background: true,
          description: 'Start Vite dev server',
        },
      ],
    ),
    inputSchema: z.object({
      command: z.string().describe('Shell command to run in the project cwd'),
      is_background: z
        .boolean()
        .optional()
        .describe('If true, return shell_id and poll with terminal_output'),
      timeout_ms: z.number().optional().describe('Optional max wait for blocking runs'),
      description: z.string().optional().describe('Short label for the UI'),
    }),
    execute: async ({ command, is_background, timeout_ms, description }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'run_terminal',
        kind: 'shell',
        action: 'shell',
        capability: 'shell',
        title: command,
        unsandboxed: true,
      })
      if (!allowed) {
        return { rejected: true, error: 'Shell access denied' }
      }

      const sandboxEnabled = ctx.settings['agent.sandbox.enabled'] ?? true
      const allowNetwork = (ctx.settings['agent.sandbox.network'] ?? 'deny') === 'allow'

      try {
        return await runTerminalCommand(ctx, {
          command,
          is_background,
          timeout_ms,
          description,
          sandboxed: sandboxEnabled,
          allowNetwork,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (sandboxEnabled && isSandboxSpawnError(message)) {
          const unsandboxedAllowed = await gateToolPermission({
            ctx: toPermCtx(ctx),
            toolCallId,
            name: 'run_terminal',
            kind: 'shell',
            action: 'shell.unsandboxed',
            capability: 'shell.unsandboxed',
            title: command,
            detail: `Sandbox blocked this command. Approve to retry without sandbox.\n\n${message}`,
            unsandboxed: true,
          })

          if (!unsandboxedAllowed) {
            return { rejected: true, error: `Sandbox blocked: ${message}` }
          }

          return runTerminalCommand(ctx, {
            command,
            is_background,
            timeout_ms,
            description,
            sandboxed: false,
          })
        }

        throw error
      }
    },
  }),
  terminal_output: tool({
    description: withToolExamples(
      'Read stdout/stderr from a background agent shell by shell_id. Use block true to wait until the shell exits.',
      [
        { shell_id: 'shell_abc123', tail: 80 },
        { shell_id: 'shell_abc123', block: true },
      ],
    ),
    inputSchema: z.object({
      shell_id: z.string().describe('Id returned by run_terminal when is_background is true'),
      block: z.boolean().optional().describe('Wait until the shell exits'),
      tail: z.number().optional().describe('Max trailing lines to return'),
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
  const callOptions = resolveModelCallOptions(ctx.settings, modelRef, {
    maxOutputTokens: SUBAGENT_MAX_OUTPUT_TOKENS,
  })
  const supportsVision = await resolveModelVision({
    model,
    providerId: modelRef.providerId,
    modelId: modelRef.modelId,
    settings: ctx.settings,
  })

  const emitNestedEvent = (event: HarnessEvent): void => {
    ctx.onHarnessEvent?.({
      type: 'subagent-event',
      subagentId,
      parentToolCallId: toolCallId,
      event,
    })
  }

  const nestedCtx: HarnessToolContext = {
    ...ctx,
    supportsVision,
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
    maxOutputTokens: callOptions.maxOutputTokens,
    temperature: callOptions.temperature,
    topP: callOptions.topP,
    topK: callOptions.topK,
    frequencyPenalty: callOptions.frequencyPenalty,
    presencePenalty: callOptions.presencePenalty,
    seed: callOptions.seed,
    providerOptions: callOptions.providerOptions,
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
    description: withToolExamples(
      'Spawn a subagent. Default mode is blocking (waits until complete). Set mode to background to run concurrently and continue the parent turn; the harness resumes when the subagent finishes.',
      [
        {
          agentName: 'explore-auth',
          prompt: 'Find where MCP trust is granted and summarize the flow.',
          mode: 'blocking',
        },
        {
          agentName: 'scan-browser',
          prompt: 'List browser tool permission gates.',
          mode: 'background',
        },
      ],
    ),
    inputSchema: z.object({
      agentName: z.string().describe('Short name shown in the UI'),
      prompt: z.string().describe('Task instructions for the subagent'),
      mode: z
        .enum(['blocking', 'background'])
        .default('blocking')
        .describe('blocking waits; background returns while it runs'),
    }),
    execute: async (
      { agentName, prompt, mode },
      { toolCallId },
    ): Promise<
      | { subagentId: string; name: string; summary: string }
      | { subagentId: string; status: 'running' }
    > => {
      if (ctx.signal?.aborted) {
        throw new Error('Subagent aborted')
      }

      const fleetLimit = ctx.settings['fleet.maxConcurrentAgents'] ?? 4
      if (fleetCounter.get() >= fleetLimit) {
        throw new Error(
          `Fleet limit reached (${fleetLimit} concurrent agents). Stop a running agent before spawning another.`,
        )
      }

      const subagentId = crypto.randomUUID()
      const model = resolveModelForRole('agent', ctx.settings)
      const blocking = mode === 'blocking'

      ctx.onHarnessEvent?.({
        type: 'subagent-start',
        subagentId,
        toolCallId,
        name: agentName,
        blocking,
        prompt,
        model,
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

        completeSubagent().catch((error) => {
          const message = error instanceof Error ? error.message : 'Subagent failed'
          failSubagent(subagentId, message)
          ctx.onHarnessEvent?.({
            type: 'subagent-result',
            subagentId,
            summary: message,
            blocking: false,
          })
        })

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
