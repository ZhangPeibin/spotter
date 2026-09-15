---
name: verify-flutter
description: Choose Dart and Flutter unit, widget, integration, golden, and device evidence at the correct fault boundary. Use with verify in Flutter repositories.
---

# Spotter Verify Flutter

Apply these project rules after `verify`:

- Pure Dart rules, validation, mapping, and state transitions use a unit test.
- A visible state, interaction, or accessibility contract uses a widget test.
- A route, cross-feature boundary, storage, network, or plugin boundary uses an integration test.
- A golden test exists only for an explicit visual contract, never as a substitute for behavior.
- A platform channel, native permission, keyboard, WebView, hardware, or performance-feel risk uses device evidence when automation cannot represent it reliably.
- Do not duplicate a Dart rule in widget, integration, and golden tests unless each test covers a different fault boundary.
- Run unrelated tests serially when they contend for process-global files, databases, ports, or child processes. Never serialize away behavior whose claim is concurrency.
- Avoid real network, wall-clock time, randomness, global mutable state, and unbounded `pumpAndSettle` as routine evidence.
