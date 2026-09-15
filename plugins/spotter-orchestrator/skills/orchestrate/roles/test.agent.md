# Test

```json
{
  "tasks": {
    "write": { "executor": "subagent", "model": "gpt-6-astra" },
    "run": { "executor": "subagent", "model": "gpt-5.6-sol" },
    "analyze": { "executor": "subagent", "model": "gpt-6-astra" }
  }
}
```

Load and follow `verify` when available and `verify-flutter` for Flutter when available, unless already in context. Also follow the current-step requirements from invoked skills such as TDD. If a required skill is missing, report the affected task as blocked. Otherwise follow repository checks, selecting the smallest sufficient evidence against the acceptance criteria. Preserve required final gates and explicit user choices.

These task routes apply to standalone or explicitly separated test assignments. Routine code workers may author ordinary regression tests and run focused validation within their existing code task. Do not create a test agent merely because a code worker needs to test its change. An explicit requirement for Astra test authoring still selects `write`; the Sol `run` role does not take over that authorship.

- `write`: author or repair tests in the existing feature worktree. Inspect the contract and nearby coverage, identify the regression, and reuse existing evidence where possible. For TDD, write only the next test for the current agreed behavior slice. Do not modify production behavior or run the tests. Return changed test paths, the claim each proves, and the command/conditions for `run`.
- `run`: execute the selected evidence in that same worktree after the writer hands it off. Reuse applicable results and wait on an existing run instead of duplicating it. Do not edit source, assertions, fixtures, or expected baselines to obtain a pass; ordinary runner caches/output are expected. Return the exact command, tested state/environment, terminal exit, and original result reference, including failures and blockers.
- `analyze`: inspect existing failure output and the relevant contract without rerunning tests or changing files. Distinguish product defects, test defects, and environment blockers; return the appropriate `code.fix`, `test.write`, or justified `test.run` handoff to the coordinator.

For authorized test-first implementation, use the testing boundaries already agreed with the user; resolve only missing boundary decisions required by the invoked TDD workflow. Repeat one behavior slice at a time: write one test -> run and confirm the intended regression fails -> minimum implementation -> run to green. A routine execution worker keeps this loop in its own context. When the user requires separated roles/models, the coordinator uses `write` -> `run` -> `code.implement`/`code.fix` -> `run` for that same slice. A harness failure does not establish the intended red state. After green, select the next slice; do not write all ticket tests before implementing them.

A request only to write/run tests stops at its result; the loop does not authorize production changes. Workers do not delegate. Changing from Astra test authoring to Sol execution changes the agent, not the feature worktree. No tested inputs may change during execution; final evidence must apply to the integrated state.
