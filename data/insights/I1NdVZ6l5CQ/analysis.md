---
title: "Claude Code & Cowork Now Run 24/7 — Scheduled Tasks"
channel: "Kenny Liao"
topic: "ai-llms"
publishedDate: "2026-02-28"
<<<<<<< HEAD
generatedAt: "2026-03-12"
=======
generatedAt: "2026-03-13"
>>>>>>> gsd/M002/S02
pattern: "headless-youtube-analysis"
contentType: "tutorial"
analysisDepth: "standard"
sourceUrl: "https://youtube.com/watch?v=I1NdVZ6l5CQ"
githubRepos:
  - "https://github.com/kenneth-liao/ai-launchpad-marketplace"
---

## Summary

<<<<<<< HEAD
Kenny Liao presents scheduled tasks as a genuinely useful automation layer for Claude rather than another speculative “agent” feature. His core claim is that recurring prompts become much more valuable when they run automatically and leave finished work waiting for you, whether that work is a morning brief, a weekly business report, or a nightly file-organization pass.

The first half of the video is demo-driven. Liao shows recurring workflows he actually uses: a daily business brief that checks calendar, email, and Sentry; a weekly Stripe sales analysis; a daily Substack note drafting flow; and a nightly brain-dump organizer that updates a structured personal context system. The throughline is not novelty but removal of repetitive setup and prompting.

He then explains how scheduled tasks work inside Claude Cowork. Tasks are configured as prompts with a selected model, working directory, and frequency, and they can use the same skills, slash commands, and MCP servers already available in Claude Code. That gives the feature leverage, but it also introduces a runtime caveat: Cowork jobs only run reliably when the machine and the Claude desktop app are both open.

To address that limitation, Liao shares a free Claude Code scheduler plugin that uses OS cron tooling to create recurring local jobs. The plugin stores task metadata in a scheduler registry, writes logs and results to predictable folders, generates wrapper scripts, and supports safer configuration choices like limited permissions, timeouts, and optional output directories.

## Key Takeaways

- **Scheduled prompts become real workflows** — Liao’s main point is that the value comes from having useful work already completed when you sit down, not from watching the agent act in real time.
- **Cowork inherits Claude Code capabilities** — Because scheduled tasks use the Claude Code stack underneath, they can call existing `skills`, `slash commands`, and configured `MCP servers` rather than living in a separate automation silo.
- **Recurring briefs are the easiest starting point** — Daily AI news, calendar plus email triage, and weekly Stripe reporting are presented as low-friction automations with immediate payoff.
- **Human review still matters** — In the Substack workflow, Liao intentionally stages note drafts for review instead of fully auto-posting them, which keeps quality control in the loop.
- **Context maintenance is a powerful backend use case** — The nightly brain-dump organizer shows that scheduled tasks are useful not just for summaries but for continuously updating a personal assistant’s structured memory files.
- **Cowork has an uptime dependency** — A scheduled task may be missed if the app is closed or the computer is off, and replay behavior on reopen is best-effort rather than guaranteed.
- **Claude Code plugin avoids app-open dependency** — The scheduler plugin runs natively on the machine via cron, so it is better suited to people who live in `Claude Code` instead of the desktop app.
- **Operational safety is part of the design** — Timeouts, scoped permissions, explicit output directories, a registry file, and per-job logs make the plugin feel more like an automation system than a one-off script hack.

## Action Items

1. **Update Claude Desktop** — Install the latest desktop app version and confirm the `Scheduled` sidebar entry or `/schedule` command appears before attempting Cowork-based automation.
2. **Prototype one recurring brief** — Create a narrow daily or weekly task such as email prioritization, a news brief, or a Stripe report, then use `Run now` to verify model choice, permissions, and output quality.
3. **Adopt the scheduler plugin for Claude Code workflows** — If you prefer local execution, install the scheduler plugin from the `ai-launchpad-marketplace` repo and let Claude create cron-backed jobs through the provided skill.
4. **Define artifact destinations up front** — For tasks that generate reports, specify an output path like `docs/plans` so outputs land where your team already reviews them.
5. **Constrain automation scope** — Add timeouts, restrict permissions, and separate “report-only” jobs from “take action” jobs so recurring tasks stay safe and debuggable.
=======
Kenny Liao’s core thesis is that scheduled tasks are one of the first AI-agent features that feel immediately durable rather than hype-driven. Instead of treating Claude as something you must open and prompt manually, he shows how recurring prompts can become background workflows that prepare useful outputs before the workday starts. The emphasis is not on abstract autonomy, but on automating repeatable, high-friction knowledge work.

The live demos make that case concrete. He shows daily business and AI news briefs, a weekly Stripe sales analysis, a recurring Substack-note drafting workflow, and a nightly brain-dump organizer that updates long-lived context files for his personal assistant. In each example, the payoff is the same: useful information or structured draft output is waiting for him at the moment it becomes valuable.

The tutorial then explains how scheduled tasks work inside Claude Cowork. Tasks are essentially prompts with configurable model, working directory, and schedule, and they can also use existing Claude Code capabilities such as slash commands, skills, and MCP servers. That makes the feature powerful, but it also exposes a practical limitation: Cowork tasks only run when both the computer and the Claude desktop app are open.

To address that limitation, Liao shares a free Claude Code scheduler plugin from his GitHub marketplace repo. The plugin uses the operating system’s built-in cron tooling, previews task configuration before creation, supports constrained permissions and timeouts, and writes artifacts into a local `.cloud/scheduler` directory with registries, logs, results, and wrapper scripts. The result is a more dependable local automation layer for users who prefer Claude Code over Cowork.

## Key Takeaways

- **Recurring prompts become infrastructure** — Liao treats scheduled tasks not as a novelty, but as a way to convert repeated prompting habits into dependable background workflows.
- **Morning context is a high-value use case** — Daily briefs for calendar, unread email, AI news, and production issues are compelling because they surface urgent information before active work begins.
- **Operational reporting fits well** — Weekly Stripe transaction analysis works because the input source is stable, the reporting cadence is predictable, and the output is useful even without further interaction.
- **Draft generation benefits from staging** — The Substack note workflow shows that AI can prepare publish-ready drafts daily while still leaving the final editorial check to a human.
- **Context maintenance can be automated** — The nightly brain-dump organizer is notable because it keeps long-term personal-assistant memory current by sorting notes into structured context files.
- **Cowork inherits Claude Code capabilities** — Because scheduled tasks run through the same underlying setup, they can use MCP servers, skills, slash commands, and project-specific working directories.
- **Cowork has runtime limitations** — Scheduled runs are not fully dependable if the desktop app is closed, even if the computer is on, which matters for users expecting true 24/7 behavior.
- **Local scheduling improves reliability** — The Claude Code plugin shifts execution to native OS scheduling, adds logs and registries, and makes recurring automation easier to inspect and trust.

## Action Items

1. **List recurring workflows** — Identify daily, weekly, or nightly tasks that already follow a repeatable prompt pattern, especially briefs, reporting, drafting, or cleanup work.
2. **Set up a low-risk pilot** — Start with a morning summary or nightly report that only reads data and writes output, rather than taking actions like publishing or editing production systems.
3. **Choose the right runtime** — Use Claude Cowork if you want easy in-app scheduling with existing skills and MCPs, or use the Claude Code plugin if you need native local execution without keeping the desktop app open.
4. **Constrain task behavior** — Add explicit output folders, limited permissions, and reasonable timeouts so each task is auditable and less likely to overreach.
5. **Manually test every task first** — Run each new workflow on demand, inspect the generated result, and verify that data sources, prompts, and output locations behave as expected.
6. **Keep sensitive flows reviewable** — For posting, cleanup, or other high-impact workflows, default to staged drafts or reports until the automation has earned trust over multiple successful runs.
>>>>>>> gsd/M002/S02

## Supporting Details

### Ideas / Methods / Claims

<<<<<<< HEAD
- **Practical autonomy over hype** — Liao explicitly distances this feature from AI hype and argues it matters because it solves recurring work he expects to remain valuable over time.
- **Prompt-first scheduling model** — A scheduled task is essentially a saved prompt plus runtime configuration such as model, working directory, and recurrence.
- **Leverage existing agent infrastructure** — The video emphasizes that scheduled jobs can invoke the same skills and MCP integrations the user already depends on in Claude Code.
- **Deliver work before the workday starts** — Several examples center on front-loading useful decisions so the user opens the computer to finished analysis rather than a blank chat box.
- **Separate reporting from execution** — In the cleanup-report example, the scheduled task is intentionally limited to scanning, recommending, and writing a report rather than mutating the project automatically.

### Tools / Repos / Resources Mentioned

- **`Claude Cowork`** — Anthropic’s environment where native scheduled tasks appear in the desktop app sidebar and via `/schedule`.
- **`Claude Code`** — Liao’s preferred environment, used as the mental model and runtime base for the plugin approach.
- **`ai-launchpad-marketplace`** — Free GitHub marketplace repo that contains the scheduler plugin and supporting scripts: `https://github.com/kenneth-liao/ai-launchpad-marketplace`
- **`Claude Desktop App`** — Required for the native Cowork feature walkthrough; linked in the description as `https://claude.com/download`.
- **`Stripe`** — Used in the weekly sales-report example to pull transaction data and generate a business analysis.
- **`Substack`** — Used in the daily note-generation example, with staging favored over fully automatic posting.
- **`Playwright MCP`** — Mentioned as the mechanism that could automate browser posting flows if the user wants end-to-end scheduling.
- **`Sentry`** — Checked in the morning business brief example to surface production issues from overnight.
- **`cron` / built-in OS scheduling tools** — The underlying mechanism the plugin uses to create recurring local jobs.
- **`registry.json`, `logs/`, `results/`, `wrappers/`** — The main scheduler artifacts created inside the project-level `.claude/scheduler` directory.

### Who This Is For

- **Claude power users** — People already using `Claude Code`, custom skills, and MCP servers who want recurring jobs without rebuilding their tooling stack.
- **Solo operators and creators** — Founders, newsletter writers, and indie builders who benefit from recurring briefs, content staging, and lightweight reporting.
- **Developers managing active projects** — Teams or individuals who want scheduled audits, cleanup reports, file organization, or overnight monitoring outputs.
- **Users building a persistent assistant context** — Anyone maintaining structured memory files or personal operating documents that can be updated from recurring notes and brain dumps.
- **Automation-curious practitioners who still want oversight** — Viewers interested in autonomous workflows but not ready to hand off irreversible actions without review.

### Risks, Gaps, or Caveats

- **Cowork runtime dependency** — Native scheduled tasks depend on both the machine and the Claude app being open, which limits reliability for true unattended execution.
- **Platform availability uncertainty** — The video mentions an online complaint that Windows support may lag, but Liao does not verify that claim directly.
- **Plugin details are shown at a high level** — The repo is linked and file structure is demonstrated, but the transcript does not provide exhaustive installation or permission-model documentation.
- **Automation can outrun review discipline** — The examples are powerful enough to automate posting or file actions, but the safest demonstrated workflows keep a human approval step in place.
- **Transcript is slightly noisy** — Some product terms and phrases appear imperfectly transcribed, but the main workflow descriptions and caveats remain clear enough to analyze reliably.
=======
- **Scheduled tasks as practical autonomy** — The video frames recurring AI execution as a meaningful step toward autonomous agents because work can happen while the user is away or asleep.
- **Prompt-first automation model** — A task is fundamentally just a prompt plus schedule, which keeps the mental model simple while still allowing sophisticated behavior.
- **Skills and MCP reuse** — Because the system uses Claude Code under the hood, existing integrations and specialized behaviors carry over into scheduled runs.
- **Human-in-the-loop publishing** — Even when browser automation could fully post content, Liao chooses a staging area to preserve review and editorial control.
- **Persistent context upkeep** — The brain-dump example shows a method for turning unstructured daily capture into continuously maintained assistant memory files.
- **Observability as part of the workflow** — Registry files, logs, result folders, and wrappers are presented as necessary scaffolding for dependable automation, not optional extras.

### Tools / Repos / Resources Mentioned

- **`Claude Cowork`** — Anthropic’s environment where scheduled tasks are shown through the sidebar and `/schedule` command.
- **`Claude Code`** — The preferred runtime for users who want local, project-based workflows and plugin-driven scheduling.
- **`ai-launchpad-marketplace`** — GitHub repository hosting the free scheduler plugin mentioned in the video: `https://github.com/kenneth-liao/ai-launchpad-marketplace`.
- **`Claude Desktop App`** — Required for the Cowork demonstration, with the presenter noting he is on version `1.1.4498` on Mac.
- **`Stripe`** — Used as the data source for a recurring weekly business report.
- **`Substack`** — Destination for the recurring note-drafting workflow.
- **`Playwright MCP`** — Mentioned as the mechanism that could automate browser posting steps end to end.
- **`.cloud/scheduler/registry.json`** — Registry file used by the Claude Code plugin to track active scheduled tasks.
- **`.cloud/scheduler/logs`** — Folder containing job logs for debugging and run inspection.
- **`.cloud/scheduler/results`** — Default output location when a task does not specify another directory.
- **`.cloud/scheduler/wrappers`** — Generated scripts that actually invoke Claude with the scheduled prompt.
- **`docs/plans`** — Example output directory for a nightly project cleanup report.

### Who This Is For

- **Claude power users** — People already using `Claude Code`, skills, and MCP servers who want to make repeated workflows automatic.
- **Solo operators and creators** — Founders, newsletter writers, and builders who need recurring summaries, drafts, and business reporting with minimal overhead.
- **Developers with local-first workflows** — Users who prefer project-scoped automation on their own machine instead of relying entirely on an app session.
- **Knowledge workers managing inflow** — Anyone dealing with email, calendar events, news monitoring, or research summaries that benefit from predictable delivery times.
- **People building personal assistant systems** — Users maintaining context files, notes, or memory structures who want unstructured capture turned into organized state.

### Risks, Gaps, or Caveats

- **Cowork runtime dependency** — Scheduled tasks in Cowork require both the computer and the Claude desktop app to be open, which weakens the promise of always-on automation.
- **Backlog re-run uncertainty** — Missed tasks may be attempted later when the app opens again, but the presenter explicitly notes that this is not guaranteed.
- **Platform coverage is unclear** — The video mentions unverified reports that scheduled tasks may not yet have been available on Windows at the time of recording.
- **Automation safety still matters** — Browser-controlled posting, cleanup suggestions, or file reorganization can become risky if permissions are too broad or human review is skipped.
- **Plugin details are only partially shown** — The tutorial demonstrates the plugin’s behavior and folder structure, but it does not fully document install steps or internals in the transcript itself.
- **Transcript quality has minor noise** — A few terms appear distorted in the transcript, such as `cloud co-work`, `cloud code`, and `highle`, but the overall meaning remains clear.
>>>>>>> gsd/M002/S02
