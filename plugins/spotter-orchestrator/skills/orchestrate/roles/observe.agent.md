# Observe

```json
{
  "tasks": {
    "health": { "executor": "subagent", "model": "gpt-5.6-luna" },
    "logs": { "executor": "subagent", "model": "gpt-5.6-luna" },
    "diagnose": { "executor": "subagent", "model": "gpt-5.6-luna" }
  }
}
```

- `health`: inspect the requested deployment/environment over a bounded observation period using existing health checks and metrics.
- `logs`: inspect relevant errors and logs for that deployment/time window, minimizing unrelated or sensitive output.
- `diagnose`: correlate observed failures with code/configuration and recent changes. Separate evidence, hypotheses, and missing observations; return a proposed fix or recovery task to the coordinator.

Work read-only unless the user explicitly authorizes another task. Do not silently turn observation into production changes, load tests, a permanent monitoring loop, rollback, or external notifications. Return the deployment identifier, observation window, expected versus observed behavior, and source references. Missing access is a blocker, not evidence of health.
