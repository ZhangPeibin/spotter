const fs = require('node:fs');
const path = require('node:path');

const baseRule = [
  'VERIFICATION HARNESS ACTIVE',
  'Reason in behavioral claims and independent fault boundaries, never file proximity, test count, or line coverage.',
  'A test exists only when it catches a concrete future regression that no retained evidence catches at the same boundary.',
  'Before adding a test, reuse or extend the closest evidence; merge equivalent triggers and assertions; delete tests that only assert implementation shape, mock choreography, or incidental text.',
  'Keep one primary evidence item for each claim and fault boundary: it must directly observe the behavior, be deterministic, and be the cheapest sufficient proof.',
  'Do not compress authorization, privacy, money, writes, migrations, deletion, recovery, concurrency, compatibility, accessibility, or explicitly required platform contracts.',
  'For each change, derive affected claims and run only their primary evidence. Skip tests whose claims do not intersect the change.',
  'Reuse a passed result only with the same commit, dependencies, configuration, and environment. Do not rerun equivalent evidence or poll a long-running suite without new evidence.',
  'A full suite is for an explicit user request, release or CI gate, framework or dependency migration, or shared-runtime change; it is not a default response to uncertainty.',
  'Report each affected claim, its selected evidence, and what was intentionally not run.',
];

const flutterProfile = [
  'FLUTTER PROFILE ACTIVE',
  'Pure Dart rules, validation, mapping, and state transitions use a unit test.',
  'A visible state, interaction, or accessibility contract uses a widget test.',
  'A route, cross-feature boundary, storage, network, or plugin seam uses an integration test.',
  'A golden test exists only for an explicit visual contract, never as a substitute for behavior.',
  'A platform channel, native permission, keyboard, WebView, hardware, or performance-feel risk uses device evidence when automation cannot represent it reliably.',
  'Do not duplicate a Dart rule in widget, integration, and golden tests unless each test covers a different fault boundary.',
  'Avoid real network, wall-clock time, randomness, global mutable state, and unbounded pumpAndSettle as routine evidence.',
].join('\n');

function isFlutterRepository(cwd) {
  return fs.existsSync(path.join(cwd, 'pubspec.yaml'));
}

function buildContext(cwd) {
  return [baseRule.join('\n'), isFlutterRepository(cwd) ? flutterProfile : '']
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { buildContext, isFlutterRepository };
