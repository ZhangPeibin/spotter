#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const evaluation = {
  workspace: 'dex-app-core',
  startedAt: '2026-09-03T16:22:25.000Z',
  sampleSize: 20,
  materialDrop: 0.2,
};

const metricNames = [
  'duplicateTestStarts',
  'noTerminalTestRuns',
  'fullSuiteRuns',
  'verificationTokens',
];

function filesBelow(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(name) : entry.name.endsWith('.jsonl') ? [name] : [];
  });
}

function literal(source) {
  if (!source) return null;
  if (source[0] === '"') {
    try { return JSON.parse(source); } catch { return null; }
  }
  if (/^\d+$/.test(source)) return Number(source);
  if (!/^[\x27`]/.test(source)) return null;
  return source.slice(1, -1).replace(/\\([\\'`])/g, '$1');
}

function property(source, name, variables = new Map()) {
  const value = '((?:"(?:\\\\.|[^"\\\\])*")|(?:\'(?:\\\\.|[^\'\\\\])*\')|(?:`(?:\\\\.|[^`\\\\])*`)|(?:[A-Za-z_$][\\w$]*)|(?:\\d+))';
  const match = source.match(new RegExp(`\\b${name}\\s*:\\s*${value}`));
  if (!match) return null;
  return variables.get(match[1]) ?? literal(match[1]);
}

function toolCalls(record) {
  const payload = record.payload || {};
  const name = (payload.name || '').split('.').at(-1);
  if (payload.type === 'function_call' && ['exec_command', 'write_stdin'].includes(name)) {
    try {
      const args = JSON.parse(payload.arguments);
      return [{ ...args, name, workdir: args.workdir || record.cwd }];
    } catch { return []; }
  }
  if (payload.type !== 'custom_tool_call' || name !== 'exec') return [];

  const input = payload.input || '';
  const variables = new Map();
  for (const match of input.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\d+)/g)) {
    variables.set(match[1], literal(match[2]));
  }
  // spotter: literal tool calls only; dynamic JS needs a parser or structured tool telemetry.
  return [...input.matchAll(/tools\.(exec_command|write_stdin)\(\{([\s\S]*?)\}\)/g)].map((match) => {
    return {
      name: match[1],
      cmd: property(match[2], 'cmd', variables),
      session_id: property(match[2], 'session_id', variables),
      workdir: property(match[2], 'workdir', variables) || record.cwd,
    };
  });
}

function withoutRedirects(command) {
  return command.replace(/("(?:\\.|[^"\\])*"|'[^']*')|\d*(?:>>?|<)\s*(?:&\d+|"(?:\\.|[^"\\])*"|'[^']*'|[^\s;&|]+)/g,
    (match, quoted) => quoted || '');
}

function testCommands(command) {
  const runners = '(?:dart\\s+test|flutter\\s+test|npm\\s+(?:run\\s+)?test|pnpm\\s+(?:run\\s+)?test|yarn\\s+test|python(?:3)?\\s+-m\\s+pytest|pytest|cargo\\s+test|go\\s+test|mvn(?:w)?\\b[^;&\\n]*?\\btest|gradle(?:w)?\\b[^;&\\n]*?\\btest|make\\s+(?:test|check))';
  const pattern = new RegExp(`(?:^|&&|\\|\\||;|\\n)\\s*((?:(?:[A-Z_][A-Z0-9_]*=\\S+)\\s+)*${runners}\\b[^;&\\n]*)`, 'gim');
  return [...withoutRedirects(command).matchAll(pattern)].map((match) => match[1].trim());
}

function normalizeTest(command) {
  return command
    .replace(/(?:^|\s)(?:-r|--reporter|--concurrency|-j)\s+\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFullSuite(command) {
  command = withoutRedirects(command).trim();
  if (/\b(?:dart|flutter)\s+test\b/i.test(command)) {
    return !/\b(?:test|integration_test|tool)\/[^\s'"\]]+|\S+\.dart\b/i.test(command)
      && !/\s(?:--(?:plain-)?name|--tags|--exclude-tags)(?:=|\s)|\s-n\s/i.test(command);
  }
  if (/\b(?:pytest|python(?:3)?\s+-m\s+pytest)\b/i.test(command)) {
    return !/\s(?:-k|--keyword|--collect-only)\b|\s\S+\.py(?:::\S+)?/i.test(command);
  }
  return /^(?:[A-Z_][A-Z0-9_]*=\S+\s+)*(?:npm (?:run )?test|pnpm (?:run )?test|yarn test|cargo test|go test(?: \.\/\.\.\.)?|make (?:test|check))\s*$/i.test(command);
}

function mutates(command) {
  if (/(?:^|[;&]\s*)(?:git\s+(?:commit|merge|rebase|cherry-pick|apply)|(?:npm|pnpm|yarn)\s+install|sed\s+-i|perl\s+-pi|cp\s|mv\s|touch\s|mkdir\s)/m.test(command)) return true;
  return /(?:^|&&|;)\s*(?:dart|flutter)\s+format\b(?![^;&\n]*--output=none)/m.test(command);
}

function embeddedResults(value, found = []) {
  if (typeof value === 'string') {
    try { return embeddedResults(JSON.parse(value), found); } catch { /* wrapped output */ }
    for (const line of value.split('\n')) {
      try { embeddedResults(JSON.parse(line), found); } catch { /* output text */ }
    }
  } else if (Array.isArray(value)) {
    for (const item of value) embeddedResults(item, found);
  } else if (value && typeof value === 'object') {
    if ('exit_code' in value || 'session_id' in value) found.push(value);
    else for (const item of Object.values(value)) embeddedResults(item, found);
  }
  return found;
}

function isPatch(record) {
  const payload = record.payload || {};
  return (payload.type === 'function_call' && payload.name === 'apply_patch')
    || (payload.type === 'custom_tool_call' && payload.name === 'apply_patch')
    || (payload.type === 'custom_tool_call' && payload.name === 'exec' && /tools\.apply_patch\s*\(/.test(payload.input || ''));
}

function inWorkspace(cwd, workspace) {
  if (path.isAbsolute(workspace)) return cwd === workspace || cwd.startsWith(`${workspace}${path.sep}`);
  return cwd.split(path.sep).includes(workspace);
}

function loadFamilies(sessionsDir, workspace) {
  const families = new Map();
  for (const file of filesBelow(sessionsDir)) {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.includes(workspace)) continue;
    const records = raw.split('\n').flatMap((line) => {
      if (!line) return [];
      try { return [JSON.parse(line)]; } catch { return []; }
    });
    const metas = records.filter((record) => record.type === 'session_meta');
    const meta = metas.find((record) => path.basename(file).endsWith(`${record.payload.id}.jsonl`))
      || metas.find((record) => record.payload.subagent_history_start_ordinal != null) || metas[0];
    const metaIndex = records.indexOf(meta);
    if (metaIndex < 0) continue;
    if (!inWorkspace(String(meta.payload.cwd || ''), workspace)) continue;
    const id = meta.payload.session_id || meta.payload.id;
    const family = families.get(id) || { id, events: [], start: meta.timestamp, rootStarts: [], rootEnds: [] };
    if (meta.timestamp < family.start) family.start = meta.timestamp;
    for (let index = metaIndex + 1; index < records.length; index++) {
      const record = records[index];
      if (record.type === 'session_meta') continue;
      if (meta.payload.subagent_history_start_ordinal != null
        && (record.ordinal ?? index) < meta.payload.subagent_history_start_ordinal) continue;
      record.cwd = meta.payload.cwd;
      record.agentId = meta.payload.id;
      family.events.push(record);
      if (meta.payload.id === id && record.type === 'event_msg') {
        if (record.payload.type === 'task_started') family.rootStarts.push(record.timestamp);
        if (record.payload.type === 'task_complete' || record.payload.type === 'turn_aborted') family.rootEnds.push(record.timestamp);
      }
    }
    families.set(id, family);
  }
  return [...families.values()].map(analyzeFamily);
}

function analyzeFamily(family) {
  family.events.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const outputs = new Map();
  const completedSessions = new Set();
  const sessionKey = (record, id) => `${record.agentId}\0${id}`;
  for (const record of family.events) {
    const payload = record.payload || {};
    if (!/call_output$/.test(payload.type || '')) continue;
    outputs.set(sessionKey(record, payload.call_id), payload.output);
    for (const result of embeddedResults(payload.output)) {
      if (result.session_id != null && result.exit_code != null) completedSessions.add(sessionKey(record, result.session_id));
    }
  }

  const metrics = { duplicateTestStarts: 0, noTerminalTestRuns: 0, fullSuiteRuns: 0, verificationTokens: 0 };
  const seen = new Set();
  const verifying = new Map();
  const tokenTotals = new Map();
  const activeAgents = new Set();
  let hasMutation = false;
  const pending = [];

  for (const record of family.events) {
    const payload = record.payload || {};
    const calls = toolCalls(record);
    const results = calls.length ? embeddedResults(outputs.get(sessionKey(record, payload.call_id))) : [];
    // Missing batch results cannot safely be associated by position.
    const resultAt = (index) => results.length === calls.length ? results[index] : null;
    calls.forEach((call, index) => {
      if (call.name === 'write_stdin' && call.session_id != null && resultAt(index)?.exit_code != null) {
        completedSessions.add(sessionKey(record, call.session_id));
      }
    });
    const changed = isPatch(record) || calls.some(({ cmd }) => cmd && mutates(cmd));
    if (changed) {
      hasMutation = true;
      seen.clear();
      verifying.set(record.agentId, false);
    }

    const runs = calls.flatMap(({ cmd, workdir }, commandIndex) =>
      (cmd ? testCommands(cmd) : []).map((test) => ({ test, workdir, commandIndex })));
    if (runs.length) {
      for (const run of runs) {
        const key = `${run.workdir}\0${normalizeTest(run.test)}`;
        if (seen.has(key)) metrics.duplicateTestStarts++;
        seen.add(key);
        if (isFullSuite(run.test)) metrics.fullSuiteRuns++;
        const result = resultAt(run.commandIndex);
        if (!result || result.exit_code == null) pending.push(result && result.session_id != null ? sessionKey(record, result.session_id) : null);
      }
      verifying.set(record.agentId, true);
    }

    if (record.type === 'event_msg' && payload.type === 'token_count') {
      const total = payload.info?.total_token_usage?.total_tokens;
      const previous = tokenTotals.get(record.agentId) || 0;
      const delta = total == null || total < previous ? payload.info?.last_token_usage?.total_tokens || 0 : total - previous;
      if (total != null) tokenTotals.set(record.agentId, total);
      if (verifying.get(record.agentId)) metrics.verificationTokens += delta;
    }
    if (record.type === 'event_msg' && (payload.type === 'task_started' || payload.type === 'task_complete' || payload.type === 'turn_aborted')) {
      verifying.set(record.agentId, false);
      if (payload.type === 'task_started') activeAgents.add(record.agentId);
      else activeAgents.delete(record.agentId);
    }
  }
  metrics.noTerminalTestRuns = pending.filter((id) => !id || !completedSessions.has(id)).length;
  const latestStart = family.rootStarts.sort().at(-1);
  const latestEnd = family.rootEnds.sort().at(-1);
  return {
    start: family.start,
    end: family.events.at(-1)?.timestamp || family.start,
    complete: Boolean(latestEnd && (!latestStart || latestEnd >= latestStart) && activeAgents.size === 0),
    hasMutation,
    metrics,
  };
}

function sum(sessions) {
  return Object.fromEntries(metricNames.map((name) => [name, sessions.reduce((total, session) => total + session.metrics[name], 0)]));
}

function samples(families, config = evaluation) {
  const before = families.filter((family) => family.complete && family.hasMutation && family.end < config.startedAt)
    .sort((a, b) => a.end.localeCompare(b.end)).slice(-config.sampleSize);
  const after = families.filter((family) => family.complete && family.hasMutation && family.start >= config.startedAt)
    .sort((a, b) => a.start.localeCompare(b.start)).slice(0, config.sampleSize);
  return { before, after };
}

function verdict(baseline, current, config = evaluation) {
  const measurable = metricNames.filter((name) => baseline[name] > 0);
  const improved = measurable.filter((name) => current[name] <= baseline[name] * (1 - config.materialDrop));
  const regressed = metricNames.filter((name) => baseline[name] === 0 ? current[name] > 0 : current[name] >= baseline[name] * (1 + config.materialDrop));
  if (measurable.length < 3) return 'pending';
  return improved.length >= 3 && regressed.length === 0 ? 'continue' : 'stop';
}

function main() {
  const sessionsDir = process.env.CODEX_SESSIONS_DIR || path.join(os.homedir(), '.codex', 'sessions');
  const families = loadFamilies(sessionsDir, evaluation.workspace);
  const { before, after } = samples(families);
  const baseline = sum(before);
  const current = sum(after);
  console.log(`Verification evaluation: ${after.length}/${evaluation.sampleSize} post-intervention development sessions`);
  console.log(`Baseline sessions: ${before.length}/${evaluation.sampleSize}`);
  for (const name of metricNames) console.log(`${name}: ${baseline[name]} -> ${current[name]}`);
  console.log('Heuristics: duplicate candidates, unresolved terminal evidence, full-suite commands, verification-token proxy.');
  console.log(before.length < evaluation.sampleSize || after.length < evaluation.sampleSize ? 'Verdict: pending' : `Verdict: ${verdict(baseline, current)}`);
}

if (require.main === module) main();

module.exports = { analyzeFamily, isFullSuite, loadFamilies, normalizeTest, samples, sum, testCommands, verdict };
