const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const evaluator = require('../scripts/evaluate');

test('evaluates one session family without counting inherited subagent history', (t) => {
  const sessions = fs.mkdtempSync(path.join(os.tmpdir(), 'spotter-sessions-'));
  t.after(() => fs.rmSync(sessions, { recursive: true, force: true }));
  const workspace = '/workspace/dex-app-core';
  const rootMeta = { type: 'session_meta', timestamp: '2026-01-01T00:00:00Z', payload: { id: 'root', session_id: 'root', cwd: workspace } };
  const childMeta = { type: 'session_meta', timestamp: '2026-01-01T00:02:00Z', payload: { id: 'child', session_id: 'root', cwd: workspace, subagent_history_start_ordinal: 4 } };
  const call = (id, cmd) => ({ type: 'response_item', timestamp: `2026-01-01T00:00:${id}Z`, payload: { type: 'custom_tool_call', name: 'exec', call_id: id, input: `const r = await tools.exec_command({cmd:${JSON.stringify(cmd)},workdir:${JSON.stringify(workspace)}}); text(r);` } });
  const output = (id, result) => ({ type: 'response_item', timestamp: `2026-01-01T00:01:${id}Z`, payload: { type: 'custom_tool_call_output', call_id: id, output: [{ type: 'input_text', text: JSON.stringify(result) }] } });
  const token = (amount, timestamp) => ({ type: 'event_msg', timestamp, payload: { type: 'token_count', info: { last_token_usage: { total_tokens: amount } } } });
  const rootRecords = [
    rootMeta,
    { type: 'event_msg', timestamp: '2026-01-01T00:00:01Z', payload: { type: 'task_started' } },
    call('10', 'dart test -r compact'), output('10', { session_id: 41 }), token(100, '2026-01-01T00:01:11Z'),
    call('20', 'dart test'), output('20', { exit_code: 0 }),
    { type: 'response_item', timestamp: '2026-01-01T00:00:25Z', payload: { type: 'custom_tool_call', name: 'apply_patch', call_id: 'patch', input: '*** Begin Patch' } },
    call('30', 'dart test'), output('30', { exit_code: 0 }),
    { type: 'event_msg', timestamp: '2026-01-01T00:01:59Z', payload: { type: 'task_complete' } },
  ];
  const childRecords = [
    childMeta,
    rootMeta,
    call('inherited', 'dart test'),
    token(9999, '2026-01-01T00:02:00Z'),
    call('40', 'dart test test/a_test.dart'), output('40', { session_id: 99 }), token(50, '2026-01-01T00:02:20Z'),
    { type: 'response_item', timestamp: '2026-01-01T00:02:29Z', payload: { type: 'custom_tool_call', name: 'exec', call_id: 'wait', input: 'text(await tools.write_stdin({session_id:99,chars:""}));' } },
    { type: 'response_item', timestamp: '2026-01-01T00:02:30Z', payload: { type: 'custom_tool_call_output', call_id: 'wait', output: [{ type: 'input_text', text: JSON.stringify({ exit_code: 0 }) }] } },
  ].map((record, ordinal) => ({ ...record, ordinal }));
  fs.writeFileSync(path.join(sessions, 'root.jsonl'), `${rootRecords.map(JSON.stringify).join('\n')}\n`);
  fs.writeFileSync(path.join(sessions, 'child.jsonl'), `${childRecords.map(JSON.stringify).join('\n')}\n`);

  const families = evaluator.loadFamilies(sessions, workspace);

  assert.equal(families.length, 1);
  assert.equal(families[0].complete, true);
  assert.equal(families[0].hasMutation, true);
  assert.deepEqual(families[0].metrics, {
    duplicateTestStarts: 1,
    noTerminalTestRuns: 1,
    fullSuiteRuns: 3,
    verificationTokens: 150,
  });
  rootRecords.push({ type: 'event_msg', timestamp: '2026-01-01T00:02:00Z', payload: { type: 'task_started' } });
  childRecords.push({ type: 'event_msg', timestamp: '2026-01-01T00:03:00Z', payload: { type: 'task_complete' } });
  fs.writeFileSync(path.join(sessions, 'root.jsonl'), `${rootRecords.map(JSON.stringify).join('\n')}\n`);
  fs.writeFileSync(path.join(sessions, 'child.jsonl'), `${childRecords.map(JSON.stringify).join('\n')}\n`);
  assert.equal(evaluator.loadFamilies(sessions, workspace)[0].complete, false, 'child completion cannot finish a running parent');
});

test('correlates terminal polls without borrowing exits or duplicating token telemetry', () => {
  const events = [];
  const add = (agentId, payload, type = 'response_item') => events.push({
    type, agentId, payload, cwd: '/workspace', timestamp: new Date(1000 * events.length).toISOString(),
  });
  const call = (agent, id, name, args) => add(agent, { type: 'function_call', name, call_id: id, arguments: JSON.stringify(args) });
  const output = (agent, id, result) => add(agent, { type: 'function_call_output', call_id: id, output: JSON.stringify(result) });
  const token = (total) => add('root', { type: 'token_count', info: {
    total_token_usage: { total_tokens: total }, last_token_usage: { total_tokens: 20 },
  } }, 'event_msg');

  token(100);
  call('root', 'start', 'exec_command', { cmd: 'dart test test/a_test.dart' });
  output('root', 'start', { session_id: 42 });
  token(120);
  token(120);
  call('root', 'poll', 'write_stdin', { session_id: 42 });
  output('root', 'poll', { exit_code: 0 });
  call('child', 'start', 'exec_command', { cmd: 'dart test test/b_test.dart' });
  output('child', 'start', { session_id: 42 });
  add('root', { type: 'custom_tool_call', name: 'exec', call_id: 'partial', input:
    'await tools.exec_command({cmd:"git status"}); await tools.exec_command({cmd:"dart test test/c_test.dart"});' });
  output('root', 'partial', { exit_code: 0 });
  const result = evaluator.analyzeFamily({ events, rootStarts: [], rootEnds: [], start: events[0].timestamp });
  assert.equal(result.metrics.noTerminalTestRuns, 2, 'child is unclosed; partial output cannot prove the test finished');
  assert.equal(result.metrics.verificationTokens, 20);
});

test('distinguishes redirected full suites from scoped tests', () => {
  for (const command of ['make check > /tmp/check.log 2>&1', 'make check > "/tmp/check log" 2>&1', 'dart test', 'flutter test -r expanded']) {
    const [testCommand] = evaluator.testCommands(command);
    assert.equal(evaluator.isFullSuite(testCommand), true, command);
  }
  for (const command of ['dart test test/funding/', 'flutter test "test/funding/"', 'dart test test/a_test.dart', 'dart test --tags unit', 'make check TEST_ARGS=test/a_test.dart']) {
    const [testCommand] = evaluator.testCommands(command);
    assert.equal(evaluator.isFullSuite(testCommand), false, command);
  }
});

test('requires three measurable improvements and rejects a twenty-percent regression', () => {
  assert.equal(evaluator.verdict(
    { duplicateTestStarts: 10, noTerminalTestRuns: 10, fullSuiteRuns: 10, verificationTokens: 1000 },
    { duplicateTestStarts: 7, noTerminalTestRuns: 7, fullSuiteRuns: 7, verificationTokens: 900 },
  ), 'continue');
  assert.equal(evaluator.verdict(
    { duplicateTestStarts: 10, noTerminalTestRuns: 10, fullSuiteRuns: 10, verificationTokens: 1000 },
    { duplicateTestStarts: 7, noTerminalTestRuns: 7, fullSuiteRuns: 7, verificationTokens: 1200 },
  ), 'stop');
  assert.equal(evaluator.verdict(
    { duplicateTestStarts: 0, noTerminalTestRuns: 0, fullSuiteRuns: 10, verificationTokens: 1000 },
    { duplicateTestStarts: 0, noTerminalTestRuns: 0, fullSuiteRuns: 7, verificationTokens: 700 },
  ), 'pending');
});
