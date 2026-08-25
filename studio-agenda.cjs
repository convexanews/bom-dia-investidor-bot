const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, 'studio-agenda.json');

function lerAgenda(file = DEFAULT_FILE) {
  try { const data = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(data) ? data : []; }
  catch { return []; }
}

function salvarAgenda(items, file = DEFAULT_FILE) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(items, null, 2));
  fs.renameSync(temp, file);
}

function validarAgendamento(input = {}) {
  const queueId = String(input.queueId || '');
  if (!/^\d{17}$/.test(queueId)) throw new Error('Projeto da fila inválido.');
  const scheduledAt = new Date(input.scheduledAt);
  if (!Number.isFinite(scheduledAt.getTime())) throw new Error('Data de agendamento inválida.');
  if (scheduledAt.getTime() < Date.now() + 60_000) throw new Error('Escolha um horário com pelo menos um minuto de antecedência.');
  return { queueId, scheduledAt: scheduledAt.toISOString() };
}

function agendar(input, file = DEFAULT_FILE) {
  const item = validarAgendamento(input);
  const items = lerAgenda(file).filter(existing => existing.queueId !== item.queueId);
  items.push({ ...item, createdAt: new Date().toISOString(), status: 'agendado' });
  items.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  salvarAgenda(items, file);
  return items.find(existing => existing.queueId === item.queueId);
}

function atualizarAgendamento(queueId, changes, file = DEFAULT_FILE) {
  const items = lerAgenda(file);
  const index = items.findIndex(item => item.queueId === queueId);
  if (index < 0) return null;
  items[index] = { ...items[index], ...changes, updatedAt: new Date().toISOString() };
  salvarAgenda(items, file);
  return items[index];
}

function agendamentosVencidos(now = Date.now(), file = DEFAULT_FILE) {
  return lerAgenda(file).filter(item => item.status === 'agendado' && new Date(item.scheduledAt).getTime() <= now);
}

module.exports = { lerAgenda, salvarAgenda, validarAgendamento, agendar, atualizarAgendamento, agendamentosVencidos, DEFAULT_FILE };
