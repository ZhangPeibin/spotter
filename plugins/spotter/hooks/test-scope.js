#!/usr/bin/env node

const { buildContext } = require('./verification-rules');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: buildContext(process.cwd()),
  },
}));
