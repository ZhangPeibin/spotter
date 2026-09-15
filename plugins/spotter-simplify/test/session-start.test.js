const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const hook = path.join(root, 'hooks', 'session-start.js');

test('injects full Spotter rules with verification guidance in a plain repository', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-plain-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const rules = fs.readFileSync(path.join(root, 'rules', 'full.md'), 'utf8').trim();
  assert.ok(rules.length > 0);
  const result = spawnSync(process.execPath, [hook], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const { hookSpecificOutput } = JSON.parse(result.stdout);
  assert.equal(hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(hookSpecificOutput.additionalContext.split(rules).length, 2);
  assert.match(hookSpecificOutput.additionalContext, /^SPOTTER MODE ACTIVE - level: full/);
  assert.doesNotMatch(hookSpecificOutput.additionalContext, /ponytail/i);
  assert.match(hookSpecificOutput.additionalContext, /\$verify/);
  assert.doesNotMatch(hookSpecificOutput.additionalContext, /\$verify-flutter/);
  assert.deepEqual(fs.readdirSync(cwd), []);
});

test('keeps the generated manifest and marketplace entry valid', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));
  const marketplace = JSON.parse(fs.readFileSync(
    path.resolve(root, '..', '..', '.agents', 'plugins', 'marketplace.json'),
    'utf8',
  ));

  assert.deepEqual(Object.keys(manifest).sort(), [
    'author', 'description', 'interface', 'name', 'version',
  ]);
  assert.equal(manifest.name, 'spotter-simplify');
  assert.match(manifest.version, /^0\.1\.0(?:\+codex\.[A-Za-z0-9.-]+)?$/);
  assert.equal(manifest.author.name, 'Peibin');
  assert.equal(manifest.interface.developerName, 'Peibin');
  assert.deepEqual(manifest.interface.capabilities, ['Verification Harness']);

  assert.equal(marketplace.name, 'personal');
  assert.deepEqual(marketplace.plugins.filter((plugin) => plugin.name === 'spotter-simplify'), [{
    name: 'spotter-simplify',
    source: { source: 'local', path: './plugins/spotter-simplify' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Productivity',
  }]);
});

test('registers every SessionStart source', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf8'));
  const registration = hooks.hooks.SessionStart[0];

  assert.equal(registration.matcher, 'startup|resume|clear|compact');
  assert.deepEqual(registration.hooks[0], {
    type: 'command',
    command: 'node "${PLUGIN_ROOT}/hooks/session-start.js"',
    timeout: 5,
    statusMessage: 'Loading Spotter guidance...',
  });
  assert.deepEqual(hooks.hooks.PostToolUse, [{
    matcher: '*',
    hooks: [{
      type: 'command',
      command: 'node "${PLUGIN_ROOT}/hooks/compile-tool-output.js"',
      timeout: 5,
    }],
  }]);
});

test('adds Dart App guardrails without writing the repository', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, 'pubspec.yaml'), 'name: example\n');
  const before = fs.readdirSync(cwd);
  const result = spawnSync(process.execPath, [hook], { cwd, encoding: 'utf8' });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(cwd), before);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /VERIFICATION HARNESS ACTIVE/);
  assert.match(output.hookSpecificOutput.additionalContext, /\$verify/);
  assert.match(output.hookSpecificOutput.additionalContext, /DART APP GUARDRAILS:/);
  assert.match(output.hookSpecificOutput.additionalContext, /one primary behavioral evidence item/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /canned PASS files/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /\$verify-flutter/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /FLUTTER PROFILE ACTIVE/);
});

test('adds the Flutter verification skill for a Flutter repository', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-flutter-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, 'pubspec.yaml'), [
    'name: example',
    'dependencies:',
    '  flutter:',
    '    sdk: flutter',
    '',
  ].join('\n'));
  const result = spawnSync(process.execPath, [hook], { cwd, encoding: 'utf8' });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.match(output.hookSpecificOutput.additionalContext, /VERIFICATION HARNESS ACTIVE/);
  assert.match(output.hookSpecificOutput.additionalContext, /FLUTTER PROFILE ACTIVE/);
  assert.match(output.hookSpecificOutput.additionalContext, /\$verify/);
  assert.match(output.hookSpecificOutput.additionalContext, /\$verify-flutter/);
});
