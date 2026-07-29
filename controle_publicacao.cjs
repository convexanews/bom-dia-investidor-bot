// Regras compartilhadas para que formatos diferentes não concorram pelo mesmo alcance.
const fs = require('fs');
const path = require('path');

const RELATORIO = path.join(__dirname, 'relatorio.json');
const DUAS_HORAS = 2 * 60 * 60 * 1000;
const LIMITE_DIARIO_PADRAO = 8;

function lerRelatorio() {
  try { return JSON.parse(fs.readFileSync(RELATORIO, 'utf8')); } catch { return []; }
}

function inicioDiaBRT() {
  const data = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  data.setHours(0, 0, 0, 0);
  return data;
}

function podePublicarFeed({ limiteDiario = LIMITE_DIARIO_PADRAO, intervaloMs = DUAS_HORAS } = {}) {
  const posts = lerRelatorio().filter(p => p.data && p.origem !== 'manual');
  const hoje = inicioDiaBRT();
  const hojeCount = posts.filter(p => new Date(p.data) >= hoje).length;
  if (hojeCount >= limiteDiario) return { permitido: false, motivo: 'limite diário global atingido' };
  const ultimo = posts[0];
  if (ultimo && Date.now() - new Date(ultimo.data).getTime() < intervaloMs) {
    return { permitido: false, motivo: 'intervalo global mínimo de duas horas' };
  }
  return { permitido: true };
}

function registrarPublicacao(dados) {
  const posts = lerRelatorio();
  posts.unshift({ data: new Date().toISOString(), ...dados });
  fs.writeFileSync(RELATORIO, JSON.stringify(posts.slice(0, 200), null, 2));
}

module.exports = { podePublicarFeed, registrarPublicacao, DUAS_HORAS, LIMITE_DIARIO_PADRAO };
