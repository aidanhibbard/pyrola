import { describe, expect, it } from 'vitest'
import createPlan, { updatePlanTodos } from '@/services/plans/write-plan'
import parsePlan from '@/services/plans/parse-plan'

describe('updatePlanTodos', () => {
  it('replaces the full todos block without leaving orphaned YAML children', () => {
    const created = createPlan({
      title: 'Orphan check',
      body: '## Goal\n\n```mermaid\nflowchart LR\n  a[A] --> b[B]\n```\n',
      todos: [
        { id: 'first', content: 'Old first', status: 'pending' },
        { id: 'second', content: 'Old second', status: 'in_progress' },
      ],
    })

    const next = updatePlanTodos(created.content, [
      { id: 'only', content: 'Replacement todo', status: 'completed' },
    ])

    expect(next).not.toContain('Old first')
    expect(next).not.toContain('Old second')
    expect(next).not.toContain('id: first')
    expect(next).not.toContain('id: second')

    const parsed = parsePlan(next)
    expect(parsed.parseError).toBeUndefined()
    expect(parsed.frontmatter?.todos).toEqual([
      { id: 'only', content: 'Replacement todo', status: 'completed' },
    ])
  })
})
