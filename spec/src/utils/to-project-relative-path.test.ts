import { describe, expect, it } from 'vitest'
import toProjectRelativePath from '@/utils/to-project-relative-path'

describe('to-project-relative-path', () => {
  it('leaves paths that are already relative', () => {
    expect(
      toProjectRelativePath('src/composables/use-agent-harness.ts', '/Users/a/proj'),
    ).toBe('src/composables/use-agent-harness.ts')
  })

  it('strips the project root from an absolute path', () => {
    expect(
      toProjectRelativePath(
        '/Users/a/proj/src/composables/use-agent-harness.ts',
        '/Users/a/proj',
      ),
    ).toBe('src/composables/use-agent-harness.ts')
  })

  it('strips a trailing slash on the project root', () => {
    expect(
      toProjectRelativePath('/Users/a/proj/src/file.ts', '/Users/a/proj/'),
    ).toBe('src/file.ts')
  })

  it('normalizes backslashes', () => {
    expect(
      toProjectRelativePath('C:\\Users\\a\\proj\\src\\file.ts', 'C:\\Users\\a\\proj'),
    ).toBe('src/file.ts')
  })
})
