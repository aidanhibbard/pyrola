import { describe, expect, it } from 'vitest'
import loadPrompt from '@/services/prompts/load-prompt'

describe('load-prompt', () => {
  it('renders base prompt with variable substitution', () => {
    const rendered = loadPrompt('system/base.md', {
      mode: 'agent',
      projectName: 'pyrola',
      projectRoot: '/tmp/pyrola',
      branchSuffix: '\n\nGit branch: main',
    })

    expect(rendered).toMatchInlineSnapshot(`
      "You are Pyrola, an AI coding agent in agent mode.

      Project: pyrola (/tmp/pyrola)

      Git branch: main

      Use tools to explore and modify the codebase when appropriate."
    `)
  })

  it('renders plan-build handoff with path and title', () => {
    const rendered = loadPrompt('handoffs/plan-build.md', {
      planPath: '.pyrola/plans/my-plan.md',
      planTitle: 'My plan',
    })

    expect(rendered).toBe(
      'Execute the plan in `.pyrola/plans/my-plan.md` (My plan). Read the plan, work through its todos, and implement the changes.',
    )
  })
})
