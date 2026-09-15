// Regras editoriais: protege o posicionamento do perfil e reduz posts de baixo valor.
const PILARES = {
  macro: ['selic', 'copom', 'juros', 'inflação', 'ipca', 'pib', 'dólar', 'câmbio', 'fiscal', 'tesouro', 'fed'],
  bolsa: ['ibovespa', 'b3', 'ação', 'ações', 'petrobras', 'vale', 'resultado', 'balanço', 'dividendo'],
  renda_fixa: ['renda fixa', 'cdb', 'lci', 'lca', 'tesouro direto', 'prefixado', 'ipca+'],
  fiis: ['fii', 'fiis', 'fundo imobiliário', 'ifix', 'cri', 'vacância'],
  cripto: ['bitcoin', 'ethereum', 'cripto', 'criptomoeda'],
  exterior: ['wall street', 'nasdaq', 'dow jones', 's&p', 'china', 'commodities'],
  mundo_empresas: ['inteligência artificial', 'inteligencia artificial', 'startup', 'big tech', 'spacex', 'tesla', 'nvidia', 'apple', 'microsoft', 'amazon', 'google', 'energia', 'petróleo', 'petroleo', 'agro'],
  brasil_eleicoes: ['eleição', 'eleições', 'eleicao', 'eleicoes', 'campanha eleitoral', 'pesquisa eleitoral', 'intenção de voto', 'intencao de voto'],
};

const BLOQUEIOS = [
  'onlyfans', 'marmota', 'futebol', 'jogador', 'técnico', 'tecnico', 'seleção',
  'copa do mundo', 'novela', 'celebridade', 'famosos', 'horóscopo', 'horoscopo',
  'loteria', 'mega-sena', 'lotofácil', 'lotofacil', 'esportes',
];

const TERMOS_POLITICA_ELEITORAL = [
  'eleição', 'eleições', 'eleicao', 'eleicoes', 'campanha eleitoral',
  'pesquisa eleitoral', 'intenção de voto', 'intencao de voto', 'candidato',
  'candidata', 'presidente', 'governador', 'congresso', 'senado', 'câmara', 'camara',
];

const TERMOS_IMPACTO_ECONOMICO = [
  'fiscal', 'imposto', 'tribut', 'orçamento', 'orcamento', 'gasto público',
  'gasto publico', 'déficit', 'deficit', 'dívida pública', 'divida publica',
  'inflação', 'inflacao', 'selic', 'juros', 'câmbio', 'cambio', 'dólar', 'dolar',
  'real', 'bolsa', 'b3', 'ibovespa', 'empresa', 'empresas', 'petrobras',
  'energia', 'combustível', 'combustivel', 'crédito', 'credito', 'emprego',
  'renda', 'preço', 'preco', 'mercado financeiro', 'investidor', 'investimento',
];

const RUIDO_PARTIDARIO = [
  'ataque pessoal', 'troca de farpas', 'polêmica', 'polemica', 'fofoca',
  'escândalo', 'escandalo', 'acusação sem prova', 'acusacao sem prova',
];

function normalizar(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function analisarBrasilEleicoes(noticia) {
  const texto = normalizar([noticia.titulo, noticia.descricao, ...(noticia.categorias || [])].join(' '));
  const ePautaPolitica = TERMOS_POLITICA_ELEITORAL.some(termo => texto.includes(normalizar(termo)));
  if (!ePautaPolitica) return { ePautaPolitica: false, aprovada: false, motivo: null };

  if (RUIDO_PARTIDARIO.some(termo => texto.includes(normalizar(termo)))) {
    return { ePautaPolitica: true, aprovada: false, motivo: 'pauta política sem caráter informativo' };
  }
  if (/pesquisa eleitoral|intencao de voto/.test(texto) && !/(registro|tse)/.test(texto)) {
    return { ePautaPolitica: true, aprovada: false, motivo: 'pesquisa eleitoral sem registro ou fonte TSE identificável' };
  }
  if (!TERMOS_IMPACTO_ECONOMICO.some(termo => texto.includes(normalizar(termo)))) {
    return { ePautaPolitica: true, aprovada: false, motivo: 'pauta política sem impacto econômico objetivo' };
  }
  return { ePautaPolitica: true, aprovada: true, motivo: null };
}

function classificarEditorial(noticia) {
  const texto = normalizar([noticia.titulo, noticia.descricao, ...(noticia.categorias || [])].join(' '));
  const bloqueio = BLOQUEIOS.find(t => texto.includes(normalizar(t)));
  if (bloqueio) return { aprovada: false, motivo: `tema bloqueado: ${bloqueio}`, pilares: [] };

  const analisePolitica = analisarBrasilEleicoes(noticia);
  if (analisePolitica.ePautaPolitica && !analisePolitica.aprovada) {
    return { aprovada: false, motivo: analisePolitica.motivo, pilares: [] };
  }

  const pilares = Object.entries(PILARES)
    .filter(([, termos]) => termos.some(t => texto.includes(normalizar(t))))
    .map(([pilar]) => pilar);
  if (analisePolitica.aprovada && !pilares.includes('brasil_eleicoes')) pilares.push('brasil_eleicoes');
  if (!pilares.length) return { aprovada: false, motivo: 'sem pilar editorial', pilares: [] };

  const impacto = Number(noticia.peso || 0);
  // A publicação automática precisa de impacto claro; menções genéricas a mercado
  // não bastam para ocupar o feed.
  if (impacto < 30) return { aprovada: false, motivo: 'impacto editorial insuficiente', pilares };
  return { aprovada: true, motivo: null, pilares };
}

module.exports = { classificarEditorial, analisarBrasilEleicoes, normalizar, PILARES };
