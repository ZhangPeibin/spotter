# Implement the SessionStart test-scope advisory

**Type:** task
**Status:** open

## Goal

Create the minimal valid `peibin-hooks` Codex plugin and inject the generic test-scope policy through `SessionStart`.

## Work

- Scaffold the plugin manifest and personal marketplace metadata with the official plugin tooling.
- Register `startup|resume|clear|compact` in `plugins/peibin-hooks/hooks/hooks.json`.
- Implement `plugins/peibin-hooks/hooks/test-scope.js` with Node.js standard library only.
- Keep the advisory and JSON construction in that file.
- Add one `node:test` file covering process exit, JSON shape, policy content, and no working-directory writes.
- Provide one command that runs all automated checks.

## Acceptance

- The plugin metadata names `peibin-hooks`, author `Peibin`, and capability `test-scope`.
- The hook returns valid `SessionStart` `additionalContext` for the configured lifecycle sources.
- The policy contains the focused, package/module, and full-suite levels.
- User requests, uncertainty, and stronger repository instructions are preserved.
- The implementation has no runtime dependencies and performs no Git or Bash inspection.
- Automated tests pass.

## References

- Spec: `.scratch/test-scope/spec.md`
- Official Hooks documentation: <https://developers.openai.com/codex/hooks/>
