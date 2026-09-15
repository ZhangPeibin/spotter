# Code

```json
{
  "tasks": {
    "workspace": { "executor": "main", "model": "gpt-6-astra" },
    "read": { "executor": "subagent", "model": "gpt-5.6-luna" },
    "implement": { "executor": "subagent", "model": "gpt-5.6-sol" },
    "fix": { "executor": "subagent", "model": "gpt-5.6-sol" },
    "refactor": { "executor": "subagent", "model": "gpt-5.6-sol" }
  }
}
```

## Workspace

The coordinator owns `workspace`. Read repository worktree instructions (including `docs/agents/worktrees.md` when present), Git status, current branch, and `git worktree list --porcelain` before creating anything. Find the feature's existing branch/worktree in project records, confirm its actual branch/path match those records, and reuse it across tickets, agents, and resumed sessions.

Apply the user's current workspace choice first, then an existing agreed feature workspace, then repository defaults, then the plugin defaults below. Honor a stated preference for isolation when it is feasible; a repository default to stay with dirty task files does not override it. Related uncommitted changes are prerequisites to preserve, not an automatic reason to abandon isolation. If isolation cannot be completed within the existing authorization without disturbing unrelated work, explain the concrete obstacle and resolve only the missing decision before dependent writes; do not silently switch to the main checkout. Likewise, honor an explicit request to work in the current checkout without inventing a separate-worktree requirement. Never duplicate a feature workspace just because its worker changes.

For a new feature workspace, use its configured base branch; otherwise use the coordinator's current committed `HEAD`, not an assumed `main` branch. Use the configured integration target, otherwise the coordinator's current named branch. Resolve an ambiguous target or detached HEAD before implementation. Record the base branch (when present), base commit, feature branch, worktree path, and integration target together in the existing feature record, then create the distinct feature branch/worktree using project naming. Never force a branch already checked out elsewhere.

Uncommitted prerequisites are not inherited. The coordinator first identifies the related changes, including sibling-repository dependencies: use an existing prerequisite commit when available, or create a checkpoint containing only related changes when existing authorization permits it. If that decision or authorization is missing, report the specific prerequisite and keep dependent work blocked until resolved. Do not stash, reset, commit unrelated edits, or copy the whole dirty tree. Configure and record the intended local dependency paths/revisions and check the required environment setup before assigning work.

Before dispatch, record the actual absolute checkout path, branch, base commit, integration target, and related prerequisite checkpoint in the existing feature record. Preserve the original checkout's unrelated and pre-existing changes when preparing isolation. When delivering, distinguish implementation complete, committed, integrated locally, and pushed; being in the main checkout with uncommitted edits is not a completed merge.

One feature worktree has one writer at a time. Handoff its path and current state when changing tasks or models; do not create another worktree for each ticket. Keep ticket-sized commits/checkpoints after acceptance, staging only owned changes within authorization. Integrate into the recorded target after feature acceptance and check the integrated result. Retain dirty, active, or unintegrated worktrees; clean up only when integration is confirmed and cleanup is authorized.

## Code Tasks

Each execution agent owns one ticket only, including its ordinary tests and acceptance corrections. Do not continue to another ticket after finishing, even in the same feature. Return the checkpoint and evidence to the coordinator, finish owned processes, and end the assignment. The coordinator accepts the ticket and releases the agent through host capabilities; the next ticket uses a fresh agent with no inherited conversation, reading the same worktree and concise project records. Independent review and explicit model-separated testing remain separate bounded assignments within the three-active-agent limit.

Acceptance correction means fixing behavior already required by this ticket. If feedback adds a new surface, workflow, shared-component migration, refresh policy, data source, or other capability outside its recorded acceptance, stop and return the scope change to the coordinator instead of implementing it in this ticket.

- `read`: trace relevant code and callers, returning source locations and findings without modifications.
- `implement`: complete the assigned ticket's bounded implementation, ordinary regression tests, and focused validation in the feature worktree. Reuse repository conventions; do not advance unrelated tickets.
- `fix`: trace the root cause and affected callers, then fix the responsible production boundary.
- `refactor`: preserve the explicit behavior/API contract and constrain changes to the assigned scope.

For routine `implement`, `fix`, and `refactor` tasks, one worker reads the needed code, makes the change, adds or repairs ordinary regression tests, runs the required focused checks, and resolves failures within its scope before reporting. An intermediate commit is a progress checkpoint, not task completion. If recorded acceptance remains unfinished and no concrete blocker or required handoff exists, continue in the same turn instead of returning a partial final for the coordinator to resume. Load the applicable verification and invoked workflow skills; preserve their gates and run TDD per agreed behavior slice when required. Before delivery, use those verification rules to check that reported commits contain the claimed changes and original test results support the claimed behavior; distinguish unfinished, uncommitted, and unverified work. Reuse applicable evidence rather than rerunning checks for the report. Reading a file or running a command is not a reason for another role handoff.

If the user explicitly requires Astra-authored tests or a separate verification/review boundary, honor that contract and return the needed `test.write`, `test.run`, or review handoff to the coordinator. Do not silently substitute ordinary worker-authored tests for an explicit model choice. Stop expanding scope for architectural decisions, changed requirements, overlapping ownership, or a reproduced blocker. Workers do not create agents. Return a concise result, changed paths/checkpoint, original evidence references, and unresolved decisions; avoid raw file/log dumps and do not add optional refinements after acceptance is met.
