#!/usr/bin/env node

const { buildContext } = require('./session-context');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: buildContext(process.cwd()),
  },
}));
