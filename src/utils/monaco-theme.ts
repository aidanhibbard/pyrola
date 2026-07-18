import type * as monaco from 'monaco-editor'

export const MONACO_EDITOR_FONT_SIZE_DEFAULT = 13

export const MONACO_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  fontSize: MONACO_EDITOR_FONT_SIZE_DEFAULT,
  lineHeight: 20,
  letterSpacing: 0.3,
  fontLigatures: true,
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  padding: { top: 8 },
  glyphMargin: false,
  overviewRulerLanes: 0,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
  },
}

export const resolveMonacoEditorOptions = (
  fontSize: number = MONACO_EDITOR_FONT_SIZE_DEFAULT,
): monaco.editor.IStandaloneEditorConstructionOptions => ({
  ...MONACO_EDITOR_OPTIONS,
  fontSize,
})

const isDarkMode = (): boolean =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark')

export const applyMonacoTheme = (monacoApi: typeof monaco): void => {
  monacoApi.editor.setTheme(isDarkMode() ? 'vs-dark' : 'vs')
}

export const observeMonacoTheme = (
  monacoApi: typeof monaco,
  onApplied?: () => void,
): (() => void) => {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const observer = new MutationObserver(() => {
    applyMonacoTheme(monacoApi)
    onApplied?.()
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  return () => {
    observer.disconnect()
  }
}
