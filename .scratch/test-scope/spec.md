# Spotter: Test Scope

**Status:** ready
**Release:** v0.1
**Feature:** `test-scope`

## Summary

Add the first capability to the `spotter` Codex plugin: concise lifecycle guidance that asks Codex to choose test scope in proportion to the current change.

The plugin advises the model through `SessionStart` developer context. It does not inspect Git, map paths to tests, intercept Bash, or block full-suite commands.

## Problem

Coding agents often run a repository's full test suite after a small, isolated edit. This slows the feedback loop and consumes unnecessary compute. Static path rules are not reliable enough to make an authoritative decision because test impact can depend on code semantics and repository structure.

## Outcome

When a Codex session starts or its context is restored, the model receives a consistent policy to:

1. Run the smallest test that can fail because of the change.
2. Expand to the affected package or module when the change crosses a local boundary.
3. Run the full suite for a repository-required final gate, shared-runtime or dependency migration, an explicit user request, or release-level verification. Uncertainty first requires identifying the affected boundaries.

## Users

Developers using Codex in repositories where full test suites are meaningfully slower than focused tests.

## Required Behaviour

### Lifecycle injection

- Register a `SessionStart` command hook for `startup`, `resume`, `clear`, and `compact`.
- Use a Node.js script with no runtime dependencies.
- Return valid JSON with:
  - `hookSpecificOutput.hookEventName` equal to `SessionStart`.
  - `hookSpecificOutput.additionalContext` containing the test-scope policy.
- Read only the working directory's `pubspec.yaml` for Dart/Flutter skill routing; do not modify the active repository.
- If the hook cannot run, normal Codex behaviour continues.

### Advisory policy

The injected context must tell Codex to:

- inspect repository instructions, changed code, dependencies, and nearby tests before choosing a command;
- start with the smallest relevant test;
- expand to package or module tests when a local boundary is crossed;
- use the full suite for required final gates, shared-runtime or dependency migrations, explicit user requests, or release verification;
- report which validation ran and which broader validation was intentionally skipped.

The wording must remain advisory. It must not claim that a test scope is guaranteed correct or override stronger repository or user instructions.

### Packaging

- Plugin and repository name: `spotter`.
- First capability name: `test-scope`.
- Author: `Peibin`.
- Include a valid Codex plugin manifest and personal marketplace entry.
- Use the default `hooks/hooks.json` location.
- Document local installation, hook trust, verification, update, and uninstall.
- Omit a public repository URL until one exists.

## Non-Goals

- `PreToolUse` blocking or command rewriting.
- Git inspection or path-to-test mappings.
- Repository-local plugin configuration.
- Automatic test execution or semantic test inference outside the model.
- Test-result caching, timing history, or duplicate-run suppression.
- CI or other agent integrations.
- Subagent-specific injection in v0.1.

## Proposed Structure

```text
spotter/
|-- .agents/plugins/marketplace.json
`-- plugins/spotter/
    |-- .codex-plugin/plugin.json
    |-- hooks/
    |   |-- hooks.json
    |   `-- test-scope.js
    `-- test/test-scope.test.js
```

The generated Codex manifest does not declare a `hooks` field; Codex discovers the default `hooks/hooks.json` path. Do not add a package dependency. The hook emits skill-loading context; `spotter-base` and `verification-flutter` own the verification policy.

## Verification

Automated checks must verify:

- the hook exits with status 0;
- stdout is valid JSON with the required `SessionStart` shape;
- the advisory contains each step of the focused-to-full ladder;
- the advisory preserves explicit user requests and stronger repository instructions;
- running the hook does not create or modify files in its working directory;
- plugin manifest validation passes.

Manual verification must install the local plugin, review and trust its hook, start a fresh Codex session, and confirm the test-scope guidance is present.

## Acceptance Criteria

- `spotter` installs as a valid local Codex plugin.
- The hook supplies the advisory on all four configured `SessionStart` sources.
- The advisory is generic and requires no repository configuration.
- No Bash command is blocked, rewritten, or automatically executed.
- All automated checks pass with one documented command.
- A fresh-session verification procedure is documented and successfully exercised.

## Risks

- Advisory guidance cannot guarantee model compliance. This is intentional for v0.1.
- An unfamiliar repository may not expose a focused command. Inspect its available evidence before choosing scope; uncertainty alone does not require a full suite.
- The project and plugin use `Spotter` as the public name and `spotter` as the technical slug.

## Source

Requirements discussion: `/Users/peibin/Desktop/test-scope-guard/discussion.md`
