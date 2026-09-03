# Peibin Hooks

Local Codex plugins. The `Verification Harness` adds session-start rules for choosing minimal, meaningful validation.

## Behavior and boundaries

The `SessionStart` hook always supplies a language-neutral base rule: tests must prove behavioral claims at independent fault boundaries, and each change runs only the smallest sufficient evidence set. It detects Flutter repositories from `pubspec.yaml` and adds rules for Dart unit, widget, integration, golden, and device evidence.

It is advisory and zero-configuration. It does not inspect Git history, run or rewrite commands, block tests, control CI, or inject guidance into subagents.

## Verification Rules

The Harness has two jobs:

- Reduce low-value test cases. A test must cover a user-visible risk that is
  not already covered at a better layer. The agent should reuse or extend the
  closest useful test, merge tests that prove the same behavior, and remove
  tests that only duplicate coverage or assert incidental implementation.
- Reduce unnecessary test execution. The agent should select the smallest
  relevant evidence set, avoid a test already running elsewhere, and avoid
  full-suite runs or repeated polling that add no evidence.

The agent records why it kept, merged, or removed tests; this is not a manual approval queue. A real-device check remains useful for platform integrations, gestures, performance, and hardware behavior, but it does not replace repeatable tests for deterministic product behavior.

## Install and trust

From this repository root, review the executable hook before trusting it:

```sh
sed -n '1,240p' plugins/peibin-hooks/hooks/hooks.json
sed -n '1,240p' plugins/peibin-hooks/hooks/test-scope.js
```

Then register this repository's marketplace and install the plugin:

```sh
codex plugin marketplace add "$(pwd)"
codex plugin add peibin-hooks@personal
codex plugin list
```

If Codex presents a hook trust prompt, approve it only after that review. Start a new Codex session in a target repository after installation. For a small isolated change, verify that Codex inspects the repository and selects a focused test before considering broader validation. For an uncertain, cross-module, release-level, or explicitly full-suite request, verify that it chooses the broader suite instead.

## Verify

Run the automated checks from the repository root:

```sh
node --test plugins/peibin-hooks/test/*.test.js
uv run --with PyYAML python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/peibin-hooks
```

The first command checks the hook output and registration. The second is the official plugin validator; replace its absolute path if Codex is installed elsewhere.

Manual verification is the fresh-session procedure in the previous section. It is deliberately interactive because only a new Codex session can demonstrate that the trusted lifecycle hook supplies its context.

## Update and uninstall

After changing the plugin, give the existing manifest a new local cachebuster and reinstall it:

```sh
python3 ~/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py plugins/peibin-hooks
codex plugin add peibin-hooks@personal
```

Start a new session to use the update. To remove it:

```sh
codex plugin remove peibin-hooks@personal
codex plugin marketplace remove personal
```

Remove the marketplace only when no other plugin uses it.
