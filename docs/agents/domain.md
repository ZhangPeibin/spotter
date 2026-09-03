# Domain Docs

Before exploring the codebase, read:

- `CONTEXT.md` at the repository root
- Relevant ADRs under `docs/adr/`

If these files do not exist, proceed silently. Create them lazily through the domain-modeling workflow when terminology or architectural decisions are resolved.

## Layout

This repository uses a single context:

/
|-- CONTEXT.md
|-- docs/adr/
`-- src/

Use terminology defined in `CONTEXT.md`. If proposed work conflicts with an existing ADR, surface the conflict explicitly instead of silently overriding it.
