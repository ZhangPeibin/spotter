#!/usr/bin/env node

const path = require('node:path');
const pluginRoot = path.resolve(__dirname, '..');
const resources = {
  pluginRoot,
  resolver: path.join(pluginRoot, 'scripts', 'resolve-model.js'),
  skillFile: path.join(pluginRoot, 'skills', 'orchestrate', 'SKILL.md'),
};

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: [
      'WORKFLOW ORCHESTRATION ACTIVE',
      'Handle small localized work directly unless delegation is requested. For delegated work, load $orchestrate and only the needed role; resolve its model from optional .codex/orchestrator.json. Explicit user model choices and subagent models are required; main-session models are preferred. Honor user workspace choices before repository defaults. One fresh execution agent per ticket; fork no history. At most three active subagents, with no plugin lifetime creation cap. Return same-ticket acceptance defects to the original worker with followup_task; failed review or large context alone does not justify replacement. Never reuse it for another ticket. After acceptance, record terminal workers with no owned runs as ended; close/release when available, but its absence does not block the next dispatch. Treat a capacity rejection as authoritative. Prefer completion notifications and the longest permitted interruptible wait; avoid status-only polling. Messages target 500 characters; above 800, rewrite first. Respect user choices and do not delegate recursively.',
      `ORCHESTRATOR_PATHS ${JSON.stringify(resources)}`,
    ].join('\n'),
  },
}));
