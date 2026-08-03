import { fsWriteFile, fsMkdir } from '@/services/pyrola/pyrola-tauri'

export type WriteHandoffInput = {
  projectRoot: string
  summary: string
  chatId: string
}

export type WriteHandoffResult = {
  path: string
  filename: string
}

export default async (input: WriteHandoffInput): Promise<WriteHandoffResult> => {
  const { projectRoot, summary, chatId } = input

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `handoff-${timestamp}.md`
  const dirPath = '.pyrola/handoffs'
  const filePath = `${dirPath}/${filename}`

  try {
    await fsMkdir({ projectRoot, path: dirPath })
  } catch {
    // Directory may already exist
  }

  const content = [
    `# Handoff — ${new Date().toLocaleString()}`,
    '',
    `**Source chat:** ${chatId}`,
    '',
    '## Summary',
    '',
    summary,
  ].join('\n')

  await fsWriteFile({
    projectRoot,
    path: filePath,
    content,
  })

  return { path: filePath, filename }
}
