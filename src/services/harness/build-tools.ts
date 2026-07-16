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
  shellRunCommand,
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

export type HarnessToolContext = {
  projectRoot: string
  settings: PyrolaSettings
  onPendingApproval: (toolCallId: string, name: string, diff: FileDiff[]) => void
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

const DEFAULT_COMMAND_TIMEOUT_MS = 30_000

const runShellCommand = async (
  ctx: HarnessToolContext,
  command: string,
): Promise<{
  command: string
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}> => {
  if (ctx.signal?.aborted) {
    throw new Error('Command aborted')
  }

  const result = await shellRunCommand({
    projectRoot: ctx.projectRoot,
    command,
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  })

  if (result.timedOut) {
    throw new Error(`Command timed out after ${DEFAULT_COMMAND_TIMEOUT_MS}ms: ${command}`)
  }

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`
    throw new Error(`Command failed (${result.exitCode}): ${detail}`)
  }

  return {
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
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
    execute: async ({ agentName }) => {
      throw new Error(`spawn_subagent is not implemented yet (${agentName})`)
      return { error: true }
    },
  }),
  create_plan: tool({
    description: 'Create a plan file',
    inputSchema: z.object({ title: z.string(), body: z.string() }),
    execute: async ({ title }) => {
      throw new Error(`create_plan is not implemented yet (${title})`)
      return { error: true }
    },
  }),
  update_plan_todo: tool({
    description: 'Update plan todos',
    inputSchema: z.object({ todos: z.array(z.record(z.unknown())) }),
    execute: async ({ todos }) => {
      throw new Error(`update_plan_todo is not implemented yet (${todos.length} todos)`)
      return { error: true }
    },
  }),
  write_studio_artifact: tool({
    description: 'Write a studio artifact',
    inputSchema: z.object({ slug: z.string(), content: z.string() }),
    execute: async ({ slug }) => {
      throw new Error(`write_studio_artifact is not implemented yet (${slug})`)
      return { error: true }
    },
  }),
  run_terminal: tool({
    description:
      'Run a shell command in the project root. Returns stdout on success. Do not use for file edits — use edit_file or write_file instead.',
    inputSchema: z.object({ command: z.string() }),
    execute: async ({ command }) => runShellCommand(ctx, command),
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
        ...(params ?? {}),
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
