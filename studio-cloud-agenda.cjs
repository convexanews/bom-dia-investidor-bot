const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { validarAgendamento } = require('./studio-agenda.cjs');
const { readInput } = require('./publicar-studio.cjs');

const execFileAsync = promisify(execFile);
const BOT_REPO = 'convexanews/bom-dia-investidor-bot';
const CLOUD_FILE = 'studio-agenda-cloud.json';
const LOCAL_CLOUD_FILE = path.join(__dirname, CLOUD_FILE);

function b64(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').toString('base64');
}

function inputFromCloudItem(item) {
  return readInput({
    STUDIO_QUEUE_ID: item.queueId,
    STUDIO_FORMAT: item.format,
    STUDIO_MEDIA_B64: b64(item.media),
    STUDIO_CAPTION_B64: b64(item.caption || ''),
    STUDIO_ORIGIN_B64: b64(item.origin || {}),
    STUDIO_OPTIONS_B64: b64(item.options || {}),
  });
}

function createCloudItem(payload, scheduledAt, now = new Date()) {
  const schedule = validarAgendamento({ queueId: payload.queueId, scheduledAt });
  const input = inputFromCloudItem({ ...payload, ...schedule });
  return {
    queueId: input.queueId,
    scheduledAt: schedule.scheduledAt,
    status: 'agendado',
    attempts: 0,
    createdAt: now.toISOString(),
    format: input.format,
    media: input.media,
    caption: input.caption,
    origin: input.origin,
    options: input.options,
  };
}

function normalizeCloudAgenda(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && /^\d{17}$/.test(String(item.queueId || '')))
    .slice(-200)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

function dueCloudItems(items, now = Date.now(), limit = 5) {
  return normalizeCloudAgenda(items).filter(item => {
    if (!['agendado', 'tentando-novamente'].includes(item.status)) return false;
    const dueAt = new Date(item.nextAttemptAt || item.scheduledAt).getTime();
    return Number.isFinite(dueAt) && dueAt <= now;
  }).slice(0, limit);
}

function retryChanges(item, error, now = new Date()) {
  const attempts = Math.max(0, Number(item.attempts) || 0) + 1;
  const terminal = attempts >= 3;
  const delayMinutes = attempts === 1 ? 5 : attempts === 2 ? 15 : 30;
  return {
    status: terminal ? 'erro' : 'tentando-novamente',
    attempts,
    error: String(error?.message || error || 'Falha desconhecida').replace(/access_token=[^&\s]+/gi, 'access_token=***').slice(0, 500),
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: terminal ? null : new Date(now.getTime() + delayMinutes * 60_000).toISOString(),
  };
}

async function gh(args, options = {}) {
  const result = await execFileAsync('gh', args, { windowsHide: true, maxBuffer: 12 * 1024 * 1024, ...options });
  return String(result.stdout || '').trim();
}

async function readRemoteCloudAgenda() {
  try {
    const output = await gh(['api', `repos/${BOT_REPO}/contents/${CLOUD_FILE}`], { timeout: 30000 });
    const file = JSON.parse(output);
    const content = Buffer.from(String(file.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
    return { items: normalizeCloudAgenda(JSON.parse(content)), sha: file.sha || '' };
  } catch (error) {
    if (/404|Not Found/i.test(String(error?.stderr || error?.message || error))) return { items: [], sha: '' };
    throw error;
  }
}

async function writeRemoteCloudAgenda(items, sha = '') {
  const temp = path.join(__dirname, `.studio-cloud-agenda-${process.pid}.json`);
  const body = {
    message: 'Agenda publicação aprovada no Studio',
    branch: 'main',
    content: Buffer.from(JSON.stringify(normalizeCloudAgenda(items), null, 2)).toString('base64'),
  };
  if (sha) body.sha = sha;
  fs.writeFileSync(temp, JSON.stringify(body));
  try {
    await gh(['api', '--method', 'PUT', `repos/${BOT_REPO}/contents/${CLOUD_FILE}`, '--input', temp], { timeout: 60000 });
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

async function scheduleInCloud(payload, scheduledAt) {
  const item = createCloudItem(payload, scheduledAt);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const remote = await readRemoteCloudAgenda();
      const items = remote.items.filter(existing => existing.queueId !== item.queueId);
      items.push(item);
      await writeRemoteCloudAgenda(items, remote.sha);
      return item;
    } catch (error) {
      lastError = error;
      if (!/409|sha|conflict/i.test(String(error?.stderr || error?.message || error))) throw error;
    }
  }
  throw lastError;
}

function readLocalCloudAgenda(file = LOCAL_CLOUD_FILE) {
  try { return normalizeCloudAgenda(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch { return []; }
}

function writeLocalCloudAgenda(items, file = LOCAL_CLOUD_FILE) {
  fs.writeFileSync(file, `${JSON.stringify(normalizeCloudAgenda(items), null, 2)}\n`);
}

module.exports = {
  BOT_REPO, CLOUD_FILE, LOCAL_CLOUD_FILE, createCloudItem, inputFromCloudItem,
  normalizeCloudAgenda, dueCloudItems, retryChanges, readRemoteCloudAgenda,
  writeRemoteCloudAgenda, scheduleInCloud, readLocalCloudAgenda, writeLocalCloudAgenda,
};
