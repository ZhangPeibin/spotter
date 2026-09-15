# Release

```json
{
  "tasks": {
    "prepare": { "executor": "subagent", "model": "gpt-5.6-sol" },
    "deploy": { "executor": "subagent", "model": "gpt-5.6-sol" },
    "rollback": { "executor": "subagent", "model": "gpt-5.6-sol" }
  }
}
```

- `prepare`: inspect the exact integrated revision, target environment, existing release procedure, configuration/migrations, required evidence, and rollback options. Return readiness and blockers without deploying. Missing test work goes back to the coordinator's `test` tasks.
- `deploy`: execute the project's existing procedure for the explicitly authorized revision/environment. Capture the actual deployment identifier and terminal outcome; hand post-release observation back to the coordinator.
- `rollback`: use the authorized recovery procedure and target, reporting its result and any data/migration implications. A failed deployment alone does not grant permission for destructive recovery.

The coordinator prepares the concrete action before requesting any missing authorization and reuses authorization already given. Product discussion, code changes, or reaching this role do not authorize deployment or external messages. Unavailable access/tools and incomplete results remain blockers; do not claim success from a launched command alone.
