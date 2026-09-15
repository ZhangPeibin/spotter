const fs = require('node:fs');
const path = require('node:path');

const fullRules = fs.readFileSync(path.join(__dirname, '..', 'rules', 'full.md'), 'utf8').trim();
const verifySkill = 'Before adding tests, running verification, or claiming a verified result, you MUST load and follow $verify, including its prohibited patterns. These are required verification constraints, not optional suggestions; respect explicit user instructions and required repository gates.';
const flutterSkill = 'FLUTTER PROFILE ACTIVE\nYou MUST also load and follow $verify-flutter for Flutter verification.';
const dartAppRules = 'DART APP GUARDRAILS: prefer real boundaries; use narrow deterministic fakes only when needed; keep one primary behavioral evidence item; preserve blocked/not-run; treat native loading and Docker as separate environments; use durable records after recap.';

function isFlutterRepository(cwd) {
  const pubspec = path.join(cwd, 'pubspec.yaml');
  return fs.existsSync(pubspec)
    && /^\s+sdk:\s*flutter\s*(?:#.*)?$/m.test(fs.readFileSync(pubspec, 'utf8'));
}

function isDartRepository(cwd) {
  return fs.existsSync(path.join(cwd, 'pubspec.yaml'));
}

function buildContext(cwd) {
  return [fullRules, 'VERIFICATION HARNESS ACTIVE', verifySkill, isDartRepository(cwd) ? dartAppRules : '', isFlutterRepository(cwd) ? flutterSkill : '']
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { buildContext, isDartRepository, isFlutterRepository };
