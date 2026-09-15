const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('role index exposes valid task definitions and required routing defaults', () => {
  const root = path.resolve(__dirname, '../skills/orchestrate');
  const index = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  const links = [...index.matchAll(/\[[^\]]+\]\((roles\/[^\s)]+\.agent\.md)\)/g)]
    .map((match) => match[1]);
  const roles = {};
  for (const name of ['product', 'planning', 'design', 'code', 'test', 'review', 'release', 'observe']) {
    const relative = `roles/${name}.agent.md`;
    assert.ok(links.includes(relative), `index links to ${relative}`);
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const blocks = [...source.matchAll(/^```json\s*\r?\n([\s\S]*?)^```[ \t]*$/gm)];
    assert.equal(blocks.length, 1, `${name} has one JSON definition`);
    const definition = JSON.parse(blocks[0][1]);
    assert.ok(definition && typeof definition === 'object' && !Array.isArray(definition), name);
    assert.ok(definition.tasks && typeof definition.tasks === 'object' && !Array.isArray(definition.tasks), `${name}.tasks`);
    assert.ok(Object.keys(definition.tasks).length > 0, `${name} defines tasks`);
    for (const [task, route] of Object.entries(definition.tasks)) {
      assert.ok(task.trim(), `${name} has a task name`);
      assert.ok(route && typeof route === 'object' && !Array.isArray(route), `${name}.${task}`);
      assert.ok(['main', 'subagent'].includes(route.executor), `${name}.${task}.executor`);
      assert.ok(['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-luna'].includes(route.model), `${name}.${task}.model`);
    }
    assert.ok(source.slice(blocks[0].index + blocks[0][0].length).trim(), `${name} has task instructions`);
    roles[name] = definition.tasks;
  }
  for (const [role, task, executor, model] of [
    ['test', 'write', 'subagent', 'gpt-6-astra'],
    ['test', 'run', 'subagent', 'gpt-5.6-sol'],
    ['planning', 'split', 'main', 'gpt-6-astra'],
    ['code', 'implement', 'subagent', 'gpt-5.6-sol'],
  ]) {
    assert.ok(roles[role][task], `${role}.${task} exists`);
    assert.equal(roles[role][task].executor, executor, `${role}.${task}.executor`);
    assert.equal(roles[role][task].model, model, `${role}.${task}.model`);
  }
});

test('resolves project model overrides from task to built-in default', (t) => {
  const plugin = path.resolve(__dirname, '..');
  const resolver = path.join(plugin, 'scripts', 'resolve-model.js');
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-models-'));
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }));

  const resolve = (role, task) => {
    const result = spawnSync(process.execPath, [resolver, role, task, repository], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };

  assert.deepEqual(resolve('test', 'run'), {
    role: 'test', task: 'run', executor: 'subagent', model: 'gpt-5.6-sol', source: 'built-in',
    modelPolicy: 'required', pluginRoot: plugin,
    roleFile: path.join(plugin, 'skills/orchestrate/roles/test.agent.md'),
  });

  assert.equal(resolve('code', 'workspace').modelPolicy, 'preferred');
  assert.equal(resolve('planning', 'split').modelPolicy, 'preferred');

  fs.mkdirSync(path.join(repository, '.codex'));
  fs.writeFileSync(path.join(repository, '.codex', 'orchestrator.json'), JSON.stringify({
    models: { main: 'custom-main-model', subagent: 'gpt-5.6-luna' },
    roles: {
      code: { model: 'gpt-6-astra' },
      test: {
        model: 'gpt-5.6-sol',
        tasks: { write: { model: 'custom-test-model' } },
      },
    },
  }));

  assert.equal(resolve('observe', 'logs').model, 'gpt-5.6-luna');
  assert.equal(resolve('planning', 'split').model, 'custom-main-model');
  assert.equal(resolve('planning', 'split').modelPolicy, 'preferred');
  assert.equal(resolve('code', 'implement').model, 'gpt-6-astra');
  assert.equal(resolve('test', 'run').model, 'gpt-5.6-sol');
  assert.equal(resolve('test', 'write').model, 'custom-test-model');
});

test('main role and task overrides remain preferences', (t) => {
  const resolver = path.resolve(__dirname, '../scripts/resolve-model.js');
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-policy-'));
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repository, '.codex'));
  const config = path.join(repository, '.codex/orchestrator.json');
  const resolve = () => {
    const result = spawnSync(process.execPath, [resolver, 'code', 'workspace', repository], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  for (const [payload, source] of [
    [{ roles: { code: { model: 'gpt-5.6-sol' } } }, 'roles.code.model'],
    [{ roles: { code: { tasks: { workspace: { model: 'gpt-5.6-sol' } } } } }, 'roles.code.tasks.workspace.model'],
  ]) {
    fs.writeFileSync(config, JSON.stringify(payload));
    const result = resolve();
    assert.equal(result.modelPolicy, 'preferred');
    assert.equal(result.model, 'gpt-5.6-sol');
    assert.equal(result.source, source);
  }
  fs.writeFileSync(config, JSON.stringify({ models: { main: 'gpt-6-astra' } }));
  assert.equal(resolve().modelPolicy, 'preferred');
  fs.unlinkSync(config);
  assert.equal(resolve().modelPolicy, 'preferred');
});

test('rejects unknown configured roles and tasks', (t) => {
  const resolver = path.resolve(__dirname, '../scripts/resolve-model.js');
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-model-errors-'));
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repository, '.codex'));
  const config = path.join(repository, '.codex', 'orchestrator.json');

  for (const [payload, message] of [
    [{ models: { worker: 'gpt-5.6-sol' } }, 'Unknown config field: models.worker'],
    [{ roles: { unknown: { model: 'gpt-5.6-sol' } } }, 'Unknown role: unknown'],
    [{ roles: { test: { tasks: { unknown: { model: 'gpt-5.6-sol' } } } } }, 'Unknown task: test.unknown'],
  ]) {
    fs.writeFileSync(config, JSON.stringify(payload));
    const result = spawnSync(process.execPath, [resolver, 'test', 'run', repository], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, new RegExp(message.replace('.', '\\.')));
  }
});
