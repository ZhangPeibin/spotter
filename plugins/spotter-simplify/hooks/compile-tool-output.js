#!/usr/bin/env node

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_MIN_CHARS = 16_000;
const DEFAULT_MAX_FEEDBACK_CHARS = 12_000;
const DEFAULT_RETENTION_HOURS = 24;
const MAX_LINE_CHARS = 500;

function integerSetting(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

function safePart(value, fallback) {
  const normalized = String(value || '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 96);
  return normalized || fallback;
}

function looksSensitive(text) {
  return [
    /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
    /\b(?:mnemonic|seed[ _-]?phrase|private[ _-]?key|password|passwd|authorization|api[ _-]?key|access[ _-]?token|refresh[ _-]?token)\b\s*[:=]\s*["']?[^\s"']{8,}/i,
  ].some((pattern) => pattern.test(text));
}

function containsMediaOrBinary(value, depth = 0) {
  if (depth > 16 || value == null) return false;
  if (Array.isArray(value)) {
    return value.some((item) => containsMediaOrBinary(item, depth + 1));
  }
  if (typeof value !== 'object') return false;
  const type = typeof value.type === 'string' ? value.type.toLowerCase() : '';
  const mime = typeof value.mimeType === 'string'
    ? value.mimeType.toLowerCase()
    : typeof value.mime_type === 'string' ? value.mime_type.toLowerCase() : '';
  if (['image', 'audio', 'video'].includes(type)) return true;
  if (/^(?:image|audio|video)\//.test(mime) || mime === 'application/octet-stream') return true;
  if ('image_url' in value || 'audio_url' in value || 'video_url' in value) return true;
  if (typeof value.blob === 'string' && value.blob.length > 1_000) return true;
  return Object.values(value).some((item) => containsMediaOrBinary(item, depth + 1));
}

function commandText(input) {
  const toolInput = input.tool_input;
  if (typeof toolInput === 'string') return toolInput;
  if (!toolInput || typeof toolInput !== 'object') return '';
  for (const key of ['command', 'cmd', 'code', 'input']) {
    if (typeof toolInput[key] === 'string') return toolInput[key];
  }
  try {
    return JSON.stringify(toolInput);
  } catch {
    return '';
  }
}

function isCompressibleVerificationOutput(input) {
  const toolName = String(input.tool_name || '').toLowerCase();
  if (!['bash', 'exec', 'exec_command'].includes(toolName)) return false;
  const command = commandText(input);
  if (!command) return false;

  // Mixed inspection/verification calls stay intact because source, diffs,
  // search matches, and business data cannot be summarized as generic logs.
  const inspection = /(?:^|[\s;&|(`"'])(?:cat|sed|rg|grep|find|awk|jq|sqlite3|curl|wget|gh|ls|head|tail)\b|\bgit\s+(?:diff|show|log|status|blame)\b/i;
  if (inspection.test(command)) return false;

  const verification = [
    /\b(?:dart|flutter)\s+(?:test|analyze|build)\b/i,
    /\bcargo\s+(?:test|build|check|clippy)\b/i,
    /\b(?:pytest|python(?:3)?\s+-m\s+(?:pytest|unittest))\b/i,
    /\bgo\s+(?:test|vet|build)\b/i,
    /\b(?:npm|pnpm|yarn)\s+(?:(?:run\s+)?(?:test|build|lint|typecheck)|test)\b/i,
    /\b(?:mvnw?|gradlew?)\b[^\n;&|]*(?:test|check|build|assemble|lint)\b/i,
    /\b(?:xcodebuild|swift\s+test)\b/i,
    /\bmake\s+(?:test|check|build|lint)\b/i,
    /\b(?:eslint|tsc|pyright|ruff\s+check)\b/i,
    /\bnode\s+--test\b/i,
  ];
  return verification.some((pattern) => pattern.test(command));
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function cleanupExpiredFiles(directory, retentionMs, now) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(directory, entry.name);
    try {
      if (now - fs.statSync(file).mtimeMs > retentionMs) fs.unlinkSync(file);
    } catch {
      // Cleanup is best effort and must never hide the current tool result.
    }
  }
}

function flatten(value, location, lines, depth = 0) {
  if (depth > 16) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 256 && /^[\[{]/.test(trimmed)) {
      try {
        flatten(JSON.parse(trimmed), `${location}.parsed`, lines, depth + 1);
        return;
      } catch {
        // It is ordinary text rather than embedded JSON.
      }
    }
    const pieces = value.split(/\r?\n/);
    for (const piece of pieces) {
      if (!piece.trim()) continue;
      const prefix = location ? `${location}: ` : '';
      if (piece.length <= MAX_LINE_CHARS) {
        lines.push(`${prefix}${piece}`);
      } else {
        const edge = Math.floor((MAX_LINE_CHARS - 24) / 2);
        lines.push(`${prefix}${piece.slice(0, edge)} ...[line clipped]... ${piece.slice(-edge)}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${location}[${index}]`, lines, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      flatten(item, location ? `${location}.${key}` : key, lines, depth + 1);
    }
    return;
  }
  if (value != null) lines.push(`${location}: ${String(value)}`);
}

function scalarMetadata(value, found = {}, depth = 0) {
  if (depth > 12 || value == null) return found;
  if (Array.isArray(value)) {
    value.forEach((item) => scalarMetadata(item, found, depth + 1));
    return found;
  }
  if (typeof value !== 'object') return found;
  const selected = new Set([
    'exit_code', 'status', 'isError', 'session_id', 'cell_id', 'path', 'duration_ms',
  ]);
  for (const [key, item] of Object.entries(value)) {
    if (selected.has(key) && ['string', 'number', 'boolean'].includes(typeof item)) {
      if (!(key in found)) found[key] = item;
    }
    scalarMetadata(item, found, depth + 1);
  }
  return found;
}

function selectedLines(lines) {
  const indexes = new Set();
  const addRange = (start, end) => {
    for (let index = Math.max(0, start); index < Math.min(lines.length, end); index++) {
      indexes.add(index);
    }
  };
  addRange(0, 20);
  addRange(lines.length - 20, lines.length);
  const diagnostic = /\b(?:error|errors|failed|failure|fatal|exception|panic|not ok|warning|warnings|denied|timeout|timed out|exit[_ ]?code|iserror)\b/i;
  let matches = 0;
  for (let index = 0; index < lines.length && matches < 80; index++) {
    if (!diagnostic.test(lines[index])) continue;
    addRange(index - 2, index + 3);
    matches++;
  }
  return [...indexes].sort((left, right) => left - right).map((index) => lines[index]);
}

function writeArtifact(input, response, serialized, now) {
  const configured = process.env.SPOTTER_TOOL_OUTPUT_DIR;
  const codexDirectory = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), '.codex');
  const base = configured
    ? path.resolve(configured)
    : path.join(codexDirectory, '.tmp', 'spotter-tool-output');
  const session = safePart(input.session_id, 'unknown-session');
  const directory = path.join(base, session);
  ensurePrivateDirectory(directory);
  const retentionHours = integerSetting(
    'SPOTTER_TOOL_OUTPUT_RETENTION_HOURS',
    DEFAULT_RETENTION_HOURS,
    1,
    168,
  );
  cleanupExpiredFiles(directory, retentionHours * 60 * 60 * 1000, now);
  const toolUse = safePart(input.tool_use_id, 'tool');
  const suffix = crypto.randomBytes(6).toString('hex');
  const file = path.join(directory, `${toolUse}-${now}-${suffix}.json`);
  const artifact = {
    schemaVersion: 1,
    createdAt: new Date(now).toISOString(),
    expiresAfterHours: retentionHours,
    sessionId: input.session_id || null,
    turnId: input.turn_id || null,
    toolUseId: input.tool_use_id || null,
    toolName: input.tool_name || null,
    cwd: input.cwd || null,
    responseSha256: crypto.createHash('sha256').update(serialized).digest('hex'),
    toolResponse: response,
  };
  fs.writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
  return { file, retentionHours, sha256: artifact.responseSha256 };
}

function buildFeedback(input, response, serialized, artifact) {
  const lines = [];
  flatten(response, 'response', lines);
  const selected = selectedLines(lines);
  const metadata = scalarMetadata(response);
  const sourceWasTruncated = /\btruncated output\b|\btokens truncated\b/i.test(serialized);
  const header = [
    'SPOTTER TOOL RESULT COMPILED',
    `tool: ${input.tool_name || 'unknown'}`,
    `received characters: ${serialized.length}`,
    `flattened non-empty lines: ${lines.length}`,
    `metadata: ${JSON.stringify(metadata)}`,
    `artifact: ${artifact.file}`,
    `sha256: ${artifact.sha256}`,
    `retention: best-effort cleanup after ${artifact.retentionHours} hours`,
    sourceWasTruncated
      ? 'completeness: INCOMPLETE - the tool had already truncated its model-facing response before this hook ran; the artifact contains only that delivered response.'
      : 'completeness: the artifact contains the complete model-facing tool_response received by this hook.',
    'retrieve narrowly with rg and sed; do not read the complete artifact unless the task truly requires every line.',
    '',
    'SELECTED EVIDENCE',
  ];
  const maxChars = integerSetting(
    'SPOTTER_TOOL_OUTPUT_MAX_FEEDBACK_CHARS',
    DEFAULT_MAX_FEEDBACK_CHARS,
    2_000,
    24_000,
  );
  let feedback = `${header.join('\n')}\n`;
  for (const line of selected) {
    const next = `${line}\n`;
    if (feedback.length + next.length > maxChars - 80) break;
    feedback += next;
  }
  if (selected.length < lines.length) feedback += `[selected ${selected.length} of ${lines.length} lines]\n`;
  return feedback.slice(0, maxChars);
}

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  if (input.hook_event_name !== 'PostToolUse' || input.tool_response == null) return;
  let serialized;
  try {
    serialized = JSON.stringify(input.tool_response);
  } catch {
    return;
  }
  const minChars = integerSetting(
    'SPOTTER_TOOL_OUTPUT_MIN_CHARS',
    DEFAULT_MIN_CHARS,
    2_000,
    1_000_000,
  );
  if (
    !serialized
    || serialized.length < minChars
    || !isCompressibleVerificationOutput(input)
    || looksSensitive(serialized)
    || containsMediaOrBinary(input.tool_response)
  ) return;
  try {
    const artifact = writeArtifact(input, input.tool_response, serialized, Date.now());
    const feedback = buildFeedback(input, input.tool_response, serialized, artifact);
    process.stdout.write(JSON.stringify({ continue: false, stopReason: feedback }));
  } catch {
    // Fail open: the original tool result remains visible when compilation fails.
  }
}

main();
