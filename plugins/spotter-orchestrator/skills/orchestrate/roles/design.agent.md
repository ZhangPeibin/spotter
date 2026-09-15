# Design

```json
{
  "tasks": {
    "investigate": { "executor": "subagent", "model": "gpt-5.6-luna" },
    "technical": { "executor": "main", "model": "gpt-6-astra" },
    "interface": { "executor": "subagent", "model": "gpt-5.6-sol" },
    "ui": { "executor": "subagent", "model": "gpt-5.6-sol" }
  }
}
```

- `investigate`: trace the existing implementation, upstream contracts, dependencies, and constraints. Distinguish unsupported capabilities from capabilities not yet integrated; cite the relevant sources.
- `technical`: select an approach and integration boundaries from the evidence. Reuse existing patterns and record consequential domain/architecture decisions with `domain-modeling` when available. Return material scope conflicts to the user.
- `interface`: specify inputs, outputs, invariants, compatibility, and error behavior for the agreed task. Return a design for coordinator review; do not silently implement it.
- `ui`: define user flows, layout, interaction, accessibility, and loading/empty/error states in the existing design system. Produce only requested design artifacts; production implementation is a separate `code` task.
