const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('marketplace plugin injects its bundled skill without changing the target repository', (t) => {
  const root = path.resolve(__dirname, '..');
  const marketplace = require('../../../.agents/plugins/marketplace.json');
  const entries = marketplace.plugins.filter((plugin) => plugin.name === 'spotter-orchestrator');
  assert.equal(entries.length, 1);
  assert.equal(path.resolve(root, '../..', entries[0].source.path), root);
  const manifest = require('../.codex-plugin/plugin.json');
  assert.equal(manifest.name, entries[0].name);

  const hooks = require('../hooks/hooks.json');
  const [registration] = hooks.hooks.SessionStart;
  assert.deepEqual(registration.matcher.split('|').sort(), ['clear', 'compact', 'resume', 'startup']);
  const [hook] = registration.hooks;
  assert.equal(hook.type, 'command');

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const before = fs.readdirSync(cwd);
  const result = spawnSync(hook.command, {
    cwd,
    shell: true,
    env: { ...process.env, PLUGIN_ROOT: root },
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd }),
    encoding: 'utf8',
    timeout: hook.timeout * 1000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const { hookSpecificOutput } = JSON.parse(result.stdout);
  assert.equal(hookSpecificOutput.hookEventName, 'SessionStart');
  const resourceLine = hookSpecificOutput.additionalContext.split('\n').find((line) => line.startsWith('ORCHESTRATOR_PATHS '));
  const resources = JSON.parse(resourceLine.slice('ORCHESTRATOR_PATHS '.length));
  assert.deepEqual(resources, {
    pluginRoot: root,
    resolver: path.join(root, 'scripts/resolve-model.js'),
    skillFile: path.join(root, 'skills/orchestrate/SKILL.md'),
  });
  const skills = [...hookSpecificOutput.additionalContext.matchAll(/\$([a-z][a-z0-9-]*)/g)];
  assert.deepEqual(skills.map((match) => match[1]), ['orchestrate']);
  for (const [, name] of skills) {
    assert.ok(fs.existsSync(path.join(root, manifest.skills, name, 'SKILL.md')));
  }
  assert.deepEqual(fs.readdirSync(cwd), before);
});

test('resource locators work after installation relocation and from an unrelated checkout', (t) => {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator paths ')));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const installed = path.join(temporary, 'plugin cache', 'spotter-orchestrator');
  const checkout = path.join(temporary, 'project checkout');
  fs.cpSync(path.resolve(__dirname, '..'), installed, { recursive: true });
  fs.mkdirSync(checkout);
  const hook = spawnSync(process.execPath, [path.join(installed, 'hooks/inject.js')], {
    cwd: checkout, encoding: 'utf8', env: { ...process.env, PLUGIN_ROOT: '/stale/plugin/path' },
  });
  assert.equal(hook.status, 0, hook.stderr);
  const context = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext;
  const resources = JSON.parse(context.split('\n').find((line) => line.startsWith('ORCHESTRATOR_PATHS ')).slice('ORCHESTRATOR_PATHS '.length));
  assert.equal(resources.pluginRoot, installed);
  assert.ok(fs.existsSync(resources.skillFile));
  const result = spawnSync(process.execPath, [resources.resolver, 'code', 'implement', checkout], { cwd: checkout, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const route = JSON.parse(result.stdout);
  assert.equal(route.pluginRoot, installed);
  assert.equal(route.roleFile, path.join(installed, 'skills/orchestrate/roles/code.agent.md'));
  assert.match(fs.readFileSync(route.roleFile, 'utf8'), /"implement"/);
  assert.deepEqual(fs.readdirSync(checkout), []);
});
