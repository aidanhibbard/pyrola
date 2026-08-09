# Plans, Studio, Skills, Agents, Rules

These sections manage files under personal or project `.pyrola/` trees.

## Plans

- Open Settings, Plans for personal plans, or open the Project view and select Plans.
- Review plan-related preferences and file surfaces for `.pyrola/plans/`.
- Use Plan mode in chat to create plans; use the Plan workbench tab to Build or Orchestrate.

## Studio (project)

- Open the Project view (sidebar context menu: Open Project), then Studio.
- Review studio preferences for artifacts under `.pyrola/studio/`.
- Use Studio mode and the Studio workbench tab to publish and edit Comark documents.

## Skills

- Open Settings, Skills for personal skills, or open the Project view and select Skills.
- Add or review skill files the harness can load with `load_skill`.
- Keep project skills under `<project>/.pyrola/skills/` when they are repo-specific.

## Agents

- Open Settings, Agents for personal agents, or open the Project view and select Agents.
- Review agent definition files for custom agent behavior in that scope.
- Prefer project agents when instructions should stay with the repo.
- Set `model` and `reasoning` in the agent markdown frontmatter when that agent should not use the Subagent default from Models settings.

## Rules

- Open Settings, Rules for personal rules, or open the Project view and select Rules.
- Add rule files that should appear in agent context for that scope.
- Keep rules short and specific; glob-scoped injection is still evolving in alpha.

## Related

- [Plans and Studio](../guide/plans-and-studio.md)
- [Modes](../guide/modes.md)
- [Settings overview](./overview.md)
- [Fleet and projects](../guide/fleet-and-projects.md)
