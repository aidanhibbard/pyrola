# Plans, Studio, Skills, Agents, Rules

These sections manage files under personal or project `.pyrola/` trees.

## Plans

- Open Settings, Personal or Project, Plans.
- Review plan-related preferences and file surfaces for `.pyrola/plans/`.
- Use Plan mode in chat to create plans; use the Plan workbench tab to Build or Orchestrate.

## Studio (project)

- Open Settings, Project, Studio.
- Review studio preferences for artifacts under `.pyrola/studio/`.
- Use Studio mode and the Studio workbench tab to publish and edit Comark documents.

## Skills

- Open Settings, Personal or Project, Skills.
- Add or review skill files the harness can load with `load_skill`.
- Keep project skills under `<project>/.pyrola/skills/` when they are repo-specific.

## Agents

- Open Settings, Personal or Project, Agents.
- Review agent definition files for custom agent behavior in that scope.
- Prefer project agents when instructions should stay with the repo.

## Rules

- Open Settings, Personal or Project, Rules.
- Add rule files that should appear in agent context for that scope.
- Keep rules short and specific; glob-scoped injection is still evolving in alpha.

## Related

- [Plans and Studio](../guide/plans-and-studio.md)
- [Modes](../guide/modes.md)
- [Settings overview](./overview.md)
