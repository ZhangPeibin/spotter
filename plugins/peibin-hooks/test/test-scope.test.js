const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const hook = path.join(root, 'hooks', 'test-scope.js');

test('keeps the generated manifest and marketplace entry valid', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));
  const marketplace = JSON.parse(fs.readFileSync(
    path.resolve(root, '..', '..', '.agents', 'plugins', 'marketplace.json'),
    'utf8',
  ));

  assert.deepEqual(Object.keys(manifest).sort(), [
    'author', 'description', 'interface', 'name', 'version',
  ]);
  assert.equal(manifest.name, 'peibin-hooks');
  assert.match(manifest.version, /^0\.1\.0(?:\+codex\.[A-Za-z0-9.-]+)?$/);
  assert.equal(manifest.author.name, 'Peibin');
  assert.equal(manifest.interface.developerName, 'Peibin');
  assert.deepEqual(manifest.interface.capabilities, ['Verification Harness']);

  assert.equal(marketplace.name, 'personal');
  assert.deepEqual(marketplace.plugins, [{
    name: 'peibin-hooks',
    source: { source: 'local', path: './plugins/peibin-hooks' },
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
    command: 'node "${PLUGIN_ROOT}/hooks/test-scope.js"',
    timeout: 5,
    statusMessage: 'Loading test-scope guidance...',
  });
});

test('emits base verification rules without writing the working directory', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'peibin-hooks-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const before = fs.readdirSync(cwd);
  const result = spawnSync(process.execPath, [hook], { cwd, encoding: 'utf8' });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(cwd), before);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /VERIFICATION HARNESS ACTIVE/);
  assert.match(output.hookSpecificOutput.additionalContext, /behavioral claim/);
  assert.match(output.hookSpecificOutput.additionalContext, /independent fault boundaries/);
  assert.match(output.hookSpecificOutput.additionalContext, /same commit, dependencies, configuration, and environment/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /FLUTTER PROFILE ACTIVE/);
});

test('adds the Flutter profile for a Flutter repository', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'peibin-hooks-flutter-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, 'pubspec.yaml'), 'name: example\n');
  const result = spawnSync(process.execPath, [hook], { cwd, encoding: 'utf8' });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.match(output.hookSpecificOutput.additionalContext, /VERIFICATION HARNESS ACTIVE/);
  assert.match(output.hookSpecificOutput.additionalContext, /FLUTTER PROFILE ACTIVE/);
  assert.match(output.hookSpecificOutput.additionalContext, /Pure Dart rules.*unit test/);
  assert.match(output.hookSpecificOutput.additionalContext, /visible state, interaction, or accessibility.*widget test/);
  assert.match(output.hookSpecificOutput.additionalContext, /platform channel.*device evidence/);
});
