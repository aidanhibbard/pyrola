import type * as monaco from 'monaco-editor'
import {
  PYROLA_CODE_THEME_DARK,
  PYROLA_CODE_THEME_LIGHT,
} from '@/components/ai-elements/code-block/pyrola-code-theme'

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

let pyrolaThemesRegistered = false

const isDarkMode = (): boolean =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark')

/** Register solid pyrola chrome themes before Shiki loads so the first paint matches. */
export const ensureMonacoBaseThemes = (monacoApi: typeof monaco): void => {
  if (pyrolaThemesRegistered) {
    return
  }

  monacoApi.editor.defineTheme(PYROLA_CODE_THEME_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#252525',
      'editor.foreground': '#d4d4d4',
    },
  })

  monacoApi.editor.defineTheme(PYROLA_CODE_THEME_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#252525',
    },
  })

  pyrolaThemesRegistered = true
}

export const markPyrolaMonacoThemesRegistered = (): void => {
  pyrolaThemesRegistered = true
}

export const resolveMonacoThemeId = (): string =>
  isDarkMode() ? PYROLA_CODE_THEME_DARK : PYROLA_CODE_THEME_LIGHT

export const resolveMonacoEditorOptions = (
  fontSize: number = MONACO_EDITOR_FONT_SIZE_DEFAULT,
): monaco.editor.IStandaloneEditorConstructionOptions => ({
  ...MONACO_EDITOR_OPTIONS,
  fontSize,
  theme: resolveMonacoThemeId(),
})

export const applyMonacoTheme = (monacoApi: typeof monaco): void => {
  ensureMonacoBaseThemes(monacoApi)
  monacoApi.editor.setTheme(resolveMonacoThemeId())
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
