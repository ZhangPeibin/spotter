#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in ${file}: ${error.message}`);
  }
}

function nonEmptyModel(value, location) {
  if (typeof value !== 'string' || !value.trim()) fail(`${location} must be a non-empty model name`);
  return value.trim();
}

function roleDefinitions(rolesDirectory) {
  return Object.fromEntries(fs.readdirSync(rolesDirectory)
    .filter((name) => name.endsWith('.agent.md'))
    .map((name) => {
      const role = name.slice(0, -'.agent.md'.length);
      const source = fs.readFileSync(path.join(rolesDirectory, name), 'utf8');
      const blocks = [...source.matchAll(/^```json\s*\r?\n([\s\S]*?)^```[ \t]*$/gm)];
      if (blocks.length !== 1) fail(`${name} must contain exactly one JSON task definition`);
      let definition;
      try {
        definition = JSON.parse(blocks[0][1]);
      } catch (error) {
        fail(`Invalid task definition in ${name}: ${error.message}`);
      }
      return [role, definition.tasks || {}];
    }));
}

function validateConfig(config, definitions, configFile) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail(`${configFile} must contain an object`);
  for (const key of Object.keys(config)) {
    if (!['models', 'roles'].includes(key)) fail(`Unknown config field: ${key}`);
  }
  if (config.models !== undefined) {
    if (!config.models || typeof config.models !== 'object' || Array.isArray(config.models)) fail('models must be an object');
    for (const [executor, model] of Object.entries(config.models)) {
      if (!['main', 'subagent'].includes(executor)) fail(`Unknown config field: models.${executor}`);
      nonEmptyModel(model, `models.${executor}`);
    }
  }
  if (config.roles === undefined) return;
  if (!config.roles || typeof config.roles !== 'object' || Array.isArray(config.roles)) fail('roles must be an object');
  for (const [role, override] of Object.entries(config.roles)) {
    if (!definitions[role]) fail(`Unknown role: ${role}`);
    if (!override || typeof override !== 'object' || Array.isArray(override)) fail(`roles.${role} must be an object`);
    for (const key of Object.keys(override)) {
      if (!['model', 'tasks'].includes(key)) fail(`Unknown config field: roles.${role}.${key}`);
    }
    if (override.model !== undefined) nonEmptyModel(override.model, `roles.${role}.model`);
    if (override.tasks === undefined) continue;
    if (!override.tasks || typeof override.tasks !== 'object' || Array.isArray(override.tasks)) fail(`roles.${role}.tasks must be an object`);
    for (const [task, taskOverride] of Object.entries(override.tasks)) {
      if (!definitions[role][task]) fail(`Unknown task: ${role}.${task}`);
      if (!taskOverride || typeof taskOverride !== 'object' || Array.isArray(taskOverride)) fail(`roles.${role}.tasks.${task} must be an object`);
      for (const key of Object.keys(taskOverride)) {
        if (key !== 'model') fail(`Unknown config field: roles.${role}.tasks.${task}.${key}`);
      }
      nonEmptyModel(taskOverride.model, `roles.${role}.tasks.${task}.model`);
    }
  }
}

const [role, task, repository = process.cwd()] = process.argv.slice(2);
if (!role || !task) fail('Usage: resolve-model.js <role> <task> [repository-root]');

const rolesDirectory = path.join(__dirname, '..', 'skills', 'orchestrate', 'roles');
const definitions = roleDefinitions(rolesDirectory);
const builtIn = definitions[role]?.[task];
if (!builtIn) fail(`Unknown role task: ${role}.${task}`);

const configFile = path.join(path.resolve(repository), '.codex', 'orchestrator.json');
const config = fs.existsSync(configFile) ? readJson(configFile) : {};
validateConfig(config, definitions, configFile);
const taskModel = config.roles?.[role]?.tasks?.[task]?.model;
const roleModel = config.roles?.[role]?.model;
const executorModel = config.models?.[builtIn.executor];
const model = taskModel ?? roleModel ?? executorModel ?? builtIn.model;
const source = taskModel !== undefined
  ? `roles.${role}.tasks.${task}.model`
  : roleModel !== undefined
    ? `roles.${role}.model`
    : executorModel !== undefined ? `models.${builtIn.executor}` : 'built-in';

const modelPolicy = builtIn.executor === 'main' ? 'preferred' : 'required';
const pluginRoot = path.resolve(__dirname, '..');
const roleFile = path.join(rolesDirectory, `${role}.agent.md`);

process.stdout.write(JSON.stringify({ role, task, executor: builtIn.executor, model, source, modelPolicy, pluginRoot, roleFile }));
