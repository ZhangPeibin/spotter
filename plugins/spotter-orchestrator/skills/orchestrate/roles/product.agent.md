# Product

```json
{
  "tasks": {
    "discuss": { "executor": "main", "model": "gpt-6-astra" },
    "research": { "executor": "subagent", "model": "gpt-5.6-luna" },
    "write_prd": { "executor": "subagent", "model": "gpt-5.6-sol" }
  }
}
```

- `discuss`: clarify users, scenarios, scope, non-goals, and acceptance criteria with the user. Use `requirements-analysis` when available and appropriate, following the repository's document locations. Keep confirmed decisions, proposals, and open questions distinct.
- `research`: investigate existing capabilities and constraints with source references. Return facts and uncertainty; do not turn assumptions into commitments or modify product code.
- `write_prd`: draft or update a PRD from agreed decisions using the project's format. Include behavior, exceptions, and acceptance criteria; flag unresolved decisions for the coordinator rather than inventing answers. Writing a PRD does not authorize implementation.
