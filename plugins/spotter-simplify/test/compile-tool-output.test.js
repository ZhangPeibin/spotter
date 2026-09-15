const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const hook = path.resolve(__dirname, '../hooks/compile-tool-output.js');

function invoke(input, directory, extraEnvironment = {}) {
  return spawnSync(process.execPath, [hook], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      SPOTTER_TOOL_OUTPUT_DIR: directory,
      SPOTTER_TOOL_OUTPUT_MIN_CHARS: '2000',
      SPOTTER_TOOL_OUTPUT_MAX_FEEDBACK_CHARS: '4000',
      ...extraEnvironment,
    },
  });
}

function event(response, overrides = {}) {
  return {
    hook_event_name: 'PostToolUse',
    session_id: 'session-1',
    turn_id: 'turn-1',
    tool_use_id: 'tool-1',
    tool_name: 'Bash',
    tool_input: { command: 'flutter test test/example_test.dart' },
    cwd: '/workspace/project',
    tool_response: response,
    ...overrides,
  };
}

test('passes small tool results through without storing another copy', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-small-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = invoke(event({ exit_code: 0, output: 'short result' }), directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('stores a large result privately and returns bounded selected evidence', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-large-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = [
    'test suite started',
    ...Array.from({ length: 300 }, (_, index) => `ordinary progress line ${index}`),
    'FATAL database fixture failed at migration 42',
    'stack frame owned_by_test',
    ...Array.from({ length: 80 }, (_, index) => `cleanup line ${index}`),
    '1207 passed, 1 failed',
  ].join('\n');

  const result = invoke(event({ exit_code: 1, output }), directory);

  assert.equal(result.status, 0, result.stderr);
  const compiled = JSON.parse(result.stdout);
  assert.equal(compiled.continue, false);
  assert.match(compiled.stopReason, /SPOTTER TOOL RESULT COMPILED/);
  assert.match(compiled.stopReason, /FATAL database fixture failed/);
  assert.match(compiled.stopReason, /1207 passed, 1 failed/);
  assert.ok(compiled.stopReason.length <= 4000);
  assert.doesNotMatch(compiled.stopReason, /ordinary progress line 150/);

  const artifactPath = compiled.stopReason.match(/^artifact: (.+)$/m)[1];
  assert.equal(fs.statSync(artifactPath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(artifactPath)).mode & 0o777, 0o700);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  assert.equal(artifact.toolResponse.output, output);
  assert.equal(artifact.toolResponse.exit_code, 1);
  assert.match(artifact.responseSha256, /^[a-f0-9]{64}$/);
  assert.equal('toolInput' in artifact, false);
});

test('does not duplicate output that looks like secret material', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-secret-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = `${'ordinary '.repeat(300)}\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz`;

  const result = invoke(event({ exit_code: 0, output }), directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('passes media and binary results through unchanged', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-media-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const result = invoke(event({
    content: [{ type: 'image', mimeType: 'image/png', data: 'a'.repeat(4_000) }],
  }), directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('passes source, search, diff, data, and unknown tool results through', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-semantic-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const response = { exit_code: 0, output: 'semantically important middle line\n'.repeat(300) };
  const inputs = [
    event(response, { tool_input: { command: 'cat lib/important.dart' } }),
    event(response, { tool_input: { command: "sed -n '1,900p' lib/important.dart" } }),
    event(response, { tool_input: { command: "rg -n 'important' lib" } }),
    event(response, { tool_input: { command: 'git diff -- lib/important.dart' } }),
    event(response, { tool_input: { command: 'sqlite3 app.db select' } }),
    event(response, { tool_name: 'mcp__example__query', tool_input: { query: 'records' } }),
    event(response, { tool_input: { command: 'flutter run --flavor dev' } }),
  ];

  for (const input of inputs) {
    const result = invoke(input, directory);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '', JSON.stringify(input.tool_input));
  }
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('compresses recognized build and static-analysis logs', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-verification-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const response = { exit_code: 0, output: 'build progress\n'.repeat(300) };
  for (const command of ['cargo clippy --all-targets', 'npm run build', 'dart analyze']) {
    const result = invoke(event(response, {
      tool_use_id: command.replace(/\W+/g, '-'),
      tool_input: { command },
    }), directory);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).continue, false);
  }
});

test('passes mixed verification and source inspection output through', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-mixed-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const response = { exit_code: 1, output: 'important source and test output\n'.repeat(300) };
  const result = invoke(event(response, {
    tool_name: 'exec',
    tool_input: { code: "await test('flutter test'); await inspect('sed -n 1,500p lib/a.dart');" },
  }), directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('reports when the tool response was already truncated', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-truncated-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = `Warning: truncated output (original token count: 9000)\n${'preview line\n'.repeat(300)}`;

  const result = invoke(event({ exit_code: 0, output }), directory);

  assert.equal(result.status, 0, result.stderr);
  const compiled = JSON.parse(result.stdout);
  assert.match(compiled.stopReason, /completeness: INCOMPLETE/);
  assert.match(compiled.stopReason, /artifact contains only that delivered response/);
});

test('ignores invalid hook input and unrelated events', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-output-invalid-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const malformed = spawnSync(process.execPath, [hook], {
    input: '{', encoding: 'utf8', env: { ...process.env, SPOTTER_TOOL_OUTPUT_DIR: directory },
  });
  const unrelated = invoke(event({ output: 'x'.repeat(3000) }, { hook_event_name: 'PreToolUse' }), directory);

  assert.equal(malformed.status, 0, malformed.stderr);
  assert.equal(malformed.stdout, '');
  assert.equal(unrelated.status, 0, unrelated.stderr);
  assert.equal(unrelated.stdout, '');
});
