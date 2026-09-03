# Feature Docs

Pre-PRD requirements discussions live at:

`docs/feature/<release>/<feature-slug>/discussion.md`

Formal PRDs and implementation tickets live in the issue tracker described by `docs/agents/issue-tracker.md`.

## Consumer rules

- `requirements-analysis` creates or resumes the configured `discussion.md`.
- The user chooses the release; do not infer it from a package version.
- Derive `<feature-slug>` as short kebab-case and state the path before writing.
- Preserve prior decisions and session history when resuming.
- Store structured analysis and decisions, not a verbatim transcript.
- Set status to `ready-for-prd` only after explicit user confirmation.
- Do not create `prd.md` here; publish formal PRDs to the issue tracker.
