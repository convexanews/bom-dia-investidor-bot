// Garante que uma notícia automática tenha foco editorial suficiente para o feed.
function normalizar(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TERMOS_POR_TEMA = {
  selic: ['selic', 'copom', 'juros', 'renda fixa', 'tesouro', 'cdb'],
  dolar: ['dolar', 'cambio', 'real', 'euro', 'moeda'],
  bitcoin: ['bitcoin', 'cripto', 'ethereum'],
  fii: ['fii', 'fundo imobiliario', 'ifix', 'vacancia'],
  dividendo: ['dividendo', 'proventos', 'jcp'],
  exterior: ['wall street', 'nasdaq', 'dow jones', 's p', 'fed', 'treasuries', 'oriente medio'],
};

function validarPautaAutomatica({ manchete, resumo, tema }) {
  const titulo = normalizar(manchete);
  const corpo = normalizar(resumo);
  if (titulo.length < 24) return { aprovada: false, motivo: 'manchete curta demais' };
  if (corpo.length < 80) return { aprovada: false, motivo: 'resumo sem contexto suficiente' };
  const termos = TERMOS_POR_TEMA[tema];
  if (termos && !termos.some(termo => `${titulo} ${corpo}`.includes(termo))) {
    return { aprovada: false, motivo: `tema ${tema} não aparece na pauta` };
  }
  return { aprovada: true, motivo: null };
}

module.exports = { normalizar, validarPautaAutomatica };
