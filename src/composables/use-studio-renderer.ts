import { ref, watch, type Ref } from 'vue'
import { fsReadFile } from '@/services/pyrola/pyrola-tauri'
import isStudioHtmlContent from '@/services/studio/is-studio-html-content'
import parseStudioArtifact from '@/services/studio/parse-studio-artifact'
import type { StudioArtifactFrontmatter } from '@/types/studio/studio-artifact'

export type StudioRendererState = {
  markdown: Ref<string>
  renderMarkdown: Ref<string>
  data: Ref<Record<string, unknown>>
  frontmatter: Ref<StudioArtifactFrontmatter>
  loading: Ref<boolean>
  parseError: Ref<string | null>
  reload: () => Promise<void>
}

const dataJsonPathFor = (artifactPath: string): string => {
  const base = artifactPath.replace(/\/index\.md$/, '')
  return `${base}/data.json`
}

export default (
  projectRoot: Ref<string | null>,
  artifactPath: Ref<string>,
  refreshToken: Ref<number>,
): StudioRendererState => {
  const markdown = ref('')
  const renderMarkdown = ref('')
  const data = ref<Record<string, unknown>>({})
  const frontmatter = ref<StudioArtifactFrontmatter>({})
  const loading = ref(true)
  const parseError = ref<string | null>(null)

  const reload = async (): Promise<void> => {
    const root = projectRoot.value
    if (!root) {
      loading.value = false
      return
    }

    loading.value = true
    parseError.value = null

    try {
      const file = await fsReadFile({ projectRoot: root, path: artifactPath.value })
      if (isStudioHtmlContent(file.content)) {
        parseError.value =
          'This artifact uses unsupported HTML. Regenerate with Comark blocks via load_skill("studio").'
        markdown.value = ''
        renderMarkdown.value = ''
        data.value = {}
        frontmatter.value = {}
        return
      }

      const parsed = parseStudioArtifact(file.content)
      frontmatter.value = parsed.frontmatter
      markdown.value = file.content
      renderMarkdown.value = parsed.body

      const sidecarPath = dataJsonPathFor(artifactPath.value)
      try {
        const sidecar = await fsReadFile({ projectRoot: root, path: sidecarPath })
        data.value = JSON.parse(sidecar.content) as Record<string, unknown>
      } catch {
        data.value = {}
      }
    } catch (error) {
      parseError.value = error instanceof Error ? error.message : 'Failed to load studio artifact'
      markdown.value = ''
      renderMarkdown.value = ''
      data.value = {}
      frontmatter.value = {}
    } finally {
      loading.value = false
    }
  }

  watch(
    [projectRoot, artifactPath, refreshToken],
    () => {
      reload().catch(() => {
        parseError.value = 'Failed to load studio artifact'
      })
    },
    { immediate: true },
  )

  return {
    markdown,
    renderMarkdown,
    data,
    frontmatter,
    loading,
    parseError,
    reload,
  }
}