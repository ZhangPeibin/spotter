# Planning

```json
{
  "tasks": {
    "split": { "executor": "main", "model": "gpt-6-astra" },
    "sequence": { "executor": "main", "model": "gpt-6-astra" }
  }
}
```

- `split`: turn a plan, PRD, or agreed conversation into independently verifiable tickets. Each ticket names its feature, delivery, acceptance criteria, and real blocking dependencies. Prefer complete behavior slices; do not split merely by technical layer. If the user invokes an available `to-tickets` skill, follow it, including its existing confirmation/publishing workflow. The role also works without that skill using the configured tracker.
- `sequence`: choose the next ticket whose blockers satisfy the coordinator's ticket-completion check: acceptance criteria, required evidence/reviews, ended writers/runs, and a recorded checkpoint. Implementation returned or tests still running does not count as complete. All tickets belonging to one feature share its existing branch and worktree, with serial implementation by default. Do not create a worktree per ticket or start a dependent ticket against an unaccepted or outdated prerequisite.

Keep task creation within the user's scope. Do not close parent issues, publish to an external tracker, or begin implementation merely because tickets have been drafted; preserve existing authorization and tracker conventions.
