// Regras editoriais: protege o posicionamento do perfil e reduz posts de baixo valor.
const PILARES = {
  macro: ['selic', 'copom', 'juros', 'inflação', 'ipca', 'pib', 'dólar', 'câmbio', 'fiscal', 'tesouro', 'fed'],
  bolsa: ['ibovespa', 'b3', 'ação', 'ações', 'petrobras', 'vale', 'resultado', 'balanço', 'dividendo'],
  renda_fixa: ['renda fixa', 'cdb', 'lci', 'lca', 'tesouro direto', 'prefixado', 'ipca+'],
  fiis: ['fii', 'fiis', 'fundo imobiliário', 'ifix', 'cri', 'vacância'],
  cripto: ['bitcoin', 'ethereum', 'cripto', 'criptomoeda'],
  exterior: ['wall street', 'nasdaq', 'dow jones', 's&p', 'china', 'commodities'],
};

const BLOQUEIOS = [
  'onlyfans', 'marmota', 'futebol', 'jogador', 'técnico', 'tecnico', 'seleção',
  'copa do mundo', 'novela', 'celebridade', 'famosos', 'horóscopo', 'horoscopo',
  'loteria', 'mega-sena', 'lotofácil', 'lotofacil', 'esportes',
];

function normalizar(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function classificarEditorial(noticia) {
  const texto = normalizar([noticia.titulo, noticia.descricao, ...(noticia.categorias || [])].join(' '));
  const bloqueio = BLOQUEIOS.find(t => texto.includes(normalizar(t)));
  if (bloqueio) return { aprovada: false, motivo: `tema bloqueado: ${bloqueio}`, pilares: [] };

  const pilares = Object.entries(PILARES)
    .filter(([, termos]) => termos.some(t => texto.includes(normalizar(t))))
    .map(([pilar]) => pilar);
  if (!pilares.length) return { aprovada: false, motivo: 'sem pilar editorial', pilares: [] };

  const impacto = Number(noticia.peso || 0);
  // A publicação automática precisa de impacto claro; menções genéricas a mercado
  // não bastam para ocupar o feed.
  if (impacto < 30) return { aprovada: false, motivo: 'impacto editorial insuficiente', pilares };
  return { aprovada: true, motivo: null, pilares };
}

module.exports = { classificarEditorial, normalizar, PILARES };
