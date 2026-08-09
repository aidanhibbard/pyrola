# Plans and Studio

Plans and Studio are structured outputs beside free-form chat.

## Plans

Plans live under `<project>/.pyrola/plans/<plan-id>/PLAN.md`.

- Switch to Plan mode when you want the agent to write a plan before coding.
- Ask the agent to create a plan for a concrete change.
- Review plan todos in the thread and Plan workbench tab.
- Click Build to execute the plan in an Agent-style run, or Orchestrate for multi-agent coordination.
- Track Built state when the plan run finishes.

## Studio

Studio artifacts live under `<project>/.pyrola/studio/<slug>/` (`index.md`, optional `data.json`).

- Switch to Studio mode when you want a Comark document (brief, memo, report, RFC-style templates).
- Ask the agent to write a studio artifact for the topic you need.
- Open the Studio workbench tab to preview and edit the published artifact.
- Prefer Comark blocks over HTML in studio documents.
- Studio can run approved shell commands (`run_terminal`) to gather live data for reports, including in Home (`_home_`) projectless chats.

## When to use which

- Use Plans for implementation sequencing and Build / Orchestrate handoff.
- Use Studio for durable documents you want to keep in the project tree.
- Use Agent mode when you already know the change and want direct edits.

Related: [Modes](./modes.md), [Workbench](./workbench.md), [Plans, Studio, Skills, Agents, Rules](../settings/plans-studio-skills-agents-rules.md).
