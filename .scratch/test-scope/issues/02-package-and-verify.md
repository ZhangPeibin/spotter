# Document, validate, and verify the local plugin

**Type:** task
**Status:** open
**Blocked by:** 01

## Goal

Make the completed v0.1 plugin installable and verifiable in a fresh Codex session.

## Work

- Add a concise README covering behaviour, boundaries, local marketplace installation, hook review/trust, update, and uninstall.
- Add an MIT license.
- Validate the plugin manifest with the official plugin validator.
- Install from the local marketplace and verify the trusted `SessionStart` hook in a fresh session.
- Record the exact automated and manual verification commands in the README.

## Acceptance

- Plugin validation passes.
- Local install and uninstall instructions are reproducible.
- A fresh Codex session receives the test-scope advisory.
- Documentation states that the feature is advisory, zero-configuration, Codex-only, and does not control CI or subagents.
- No public repository URL or `Spotter` migration work is added.

## References

- Spec: `.scratch/test-scope/spec.md`
