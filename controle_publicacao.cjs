// Regras compartilhadas para que formatos diferentes não concorram pelo mesmo alcance.
const fs = require('fs');
const path = require('path');

const RELATORIO = path.join(__dirname, 'relatorio.json');
const DUAS_HORAS = 2 * 60 * 60 * 1000;
// Perfil em crescimento: prioriza consistência e qualidade, não volume.
const LIMITE_DIARIO_PADRAO = 2;

function lerRelatorio() {
  try { return JSON.parse(fs.readFileSync(RELATORIO, 'utf8')); } catch { return []; }
}

function inicioDiaBRT(agora = new Date()) {
  const data = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  data.setHours(0, 0, 0, 0);
  return data;
}

function horaBRT(agora = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23',
  }).format(agora));
}

function estaNaJanelaDePublicacao(agora = new Date()) {
  const hora = horaBRT(agora);
  return hora >= 6 && hora <= 22;
}

function podePublicarFeed({ limiteDiario = LIMITE_DIARIO_PADRAO, intervaloMs = DUAS_HORAS, agora = new Date() } = {}) {
  if (!estaNaJanelaDePublicacao(agora)) return { permitido: false, motivo: 'fora da janela de publicação (06h–22h BRT)' };
  const posts = lerRelatorio().filter(p => p.data && p.origem !== 'manual');
  const hoje = inicioDiaBRT(agora);
  const hojeCount = posts.filter(p => new Date(p.data) >= hoje).length;
  if (hojeCount >= limiteDiario) return { permitido: false, motivo: 'limite diário global atingido' };
  const ultimo = posts[0];
  if (ultimo && agora.getTime() - new Date(ultimo.data).getTime() < intervaloMs) {
    return { permitido: false, motivo: 'intervalo global mínimo de duas horas' };
  }
  return { permitido: true };
}

function registrarPublicacao(dados) {
  const posts = lerRelatorio();
  posts.unshift({ data: new Date().toISOString(), ...dados });
  fs.writeFileSync(RELATORIO, JSON.stringify(posts.slice(0, 200), null, 2));
}

module.exports = { podePublicarFeed, registrarPublicacao, DUAS_HORAS, LIMITE_DIARIO_PADRAO, estaNaJanelaDePublicacao };
