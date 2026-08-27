const { buscarConteudoArtigo, baixarImagemBase64 } = require('./imagem_noticia.cjs');
const { corrigirTextoEditorial } = require('./radar_noticias.cjs');
const { limitarTexto } = require('./formato_editorial.cjs');

const PALETTE = { colorA: '#071d18', colorB: '#0c4b38', accent: '#d9aa43' };

const IMPACT_BY_PILLAR = {
  cripto: 'A notícia pode alterar a percepção de risco, o volume e a volatilidade dos criptoativos.',
  bolsa: 'O movimento pode influenciar expectativas para empresas, setores e o desempenho da Bolsa brasileira.',
  exterior: 'O cenário externo afeta dólar, juros e o apetite por risco nos mercados brasileiros.',
  renda_fixa: 'Mudanças nas expectativas de juros alteram preços, taxas e oportunidades na renda fixa.',
  fiis: 'Juros, inflação e atividade econômica influenciam rendimentos e preços dos fundos imobiliários.',
  macro: 'O dado ajuda a formar expectativas para inflação, juros, câmbio e atividade econômica.',
};

const RADAR_BY_PILLAR = {
  cripto: 'Acompanhe preço, volume, regulação e a reação dos principais criptoativos.',
  bolsa: 'Observe o índice, os setores envolvidos, o volume negociado e o fluxo estrangeiro.',
  exterior: 'Monitore bolsas globais, dólar, juros americanos e commodities.',
  renda_fixa: 'Compare a curva de juros, a inflação esperada e as taxas dos títulos.',
  fiis: 'Observe juros futuros, vacância, rendimentos e comunicados dos fundos.',
  macro: 'Os próximos indicadores e decisões de política econômica confirmarão ou limitarão o movimento.',
};

function cleanEditorial(value) {
  return corrigirTextoEditorial(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b(?:data-(?:image-caption|large-file)|srcset|sizes|class|style)\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/\bThe post\b[\s\S]*?\bappeared first on\b[^.]*\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function completeText(value, max = 280) {
  const clean = cleanEditorial(value);
  if (clean.length <= max) return clean;
  const window = clean.slice(0, max + 1);
  const sentence = Math.max(window.lastIndexOf('.'), window.lastIndexOf('!'), window.lastIndexOf('?'));
  if (sentence >= Math.min(70, max * .45)) return window.slice(0, sentence + 1).trim();
  return limitarTexto(window, max);
}

function categoryOf(noticia) {
  return String(noticia.categorias?.[0] || noticia.pilares?.[0] || 'Mercado agora')
    .replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase()).slice(0, 28);
}

function pillarOf(noticia) {
  return String(noticia.pilares?.[0] || 'macro').toLowerCase();
}

function baseSlide(overrides = {}) {
  return { category: 'Mercado agora', headline: '', body: '', source: '', imageCredit: '', cta: '', duration: 4, ...PALETTE, image: '', ...overrides };
}

function buildCaption({ title, summary, source, pillar }) {
  const hashtags = {
    cripto: '#bitcoin #cripto #mercadocripto', bolsa: '#ibovespa #bolsa #acoes',
    exterior: '#wallstreet #mercadoglobal #investimentos', renda_fixa: '#rendafixa #selic #tesourodireto',
    fiis: '#fiis #fundosimobiliarios #investimentos', macro: '#economia #mercadofinanceiro #investimentos',
  }[pillar] || '#mercadofinanceiro #investimentos';
  return `${title}\n\n${summary}\n\nFonte das informações: ${source}.\n\n📌 Salve para acompanhar os próximos desdobramentos.\n\nConteúdo informativo; não é recomendação de investimento.\n\n${hashtags} #bomdiainvestidor`.slice(0, 2200);
}

function buildStudioProject(noticia, { format = 'feed', article = {}, images = [] } = {}) {
  if (!['feed', 'story', 'carousel', 'reel'].includes(format)) throw new Error('Formato automático inválido.');
  const source = cleanEditorial(noticia.fonte || 'Fonte original').slice(0, 80);
  const title = completeText(noticia.titulo, 145);
  const blocks = (article.blocos || []).map(value => completeText(value, 285)).filter(value => value.length >= 45);
  const rssSummary = completeText(noticia.descricao, 285);
  const summary = blocks[0] || rssSummary;
  const context = blocks[1] || summary;
  const detail = blocks[2] || context;
  const pillar = pillarOf(noticia);
  const impact = blocks[2] || IMPACT_BY_PILLAR[pillar] || IMPACT_BY_PILLAR.macro;
  const radar = blocks[3] || RADAR_BY_PILLAR[pillar] || RADAR_BY_PILLAR.macro;
  const category = categoryOf(noticia);
  const imageFor = index => images.length ? images[index % images.length] : '';
  const common = (index, overrides) => baseSlide({
    image: imageFor(index), imageCredit: source ? `Imagem: ${source}` : '', source: `Fonte: ${source}`, ...overrides,
  });
  let slides;
  if (format === 'feed' || format === 'story') {
    slides = [common(0, { category, headline: title, body: summary, cta: format === 'story' ? 'Confira no perfil →' : 'Leia a legenda ↓', duration: 8 })];
  } else if (format === 'carousel') {
    slides = [
      common(0, { category, headline: title, body: summary, cta: 'Arraste para entender →' }),
      common(1, { category: 'O que aconteceu', headline: 'O fato por trás da manchete', body: summary, cta: 'Veja o contexto →' }),
      common(2, { category: 'Contexto', headline: 'O que explica esse movimento', body: context, cta: 'Entenda o impacto →' }),
      common(3, { category: 'Por que importa', headline: 'O impacto para o investidor', body: impact, cta: 'Continue para o radar →' }),
      common(4, { category: 'No radar', headline: 'O que acompanhar a partir de agora', body: radar, cta: 'Confira a fonte →' }),
      common(0, { category: 'Fonte', headline: `Informação publicada por ${source}`, body: 'Acompanhe os próximos dados e a matéria original antes de tomar decisões.', cta: 'Salve este resumo' }),
    ];
  } else {
    slides = [
      common(0, { category: 'Notícia em destaque', headline: title, body: summary, cta: 'Continue assistindo', duration: 4 }),
      common(1, { category: 'O que aconteceu', headline: 'O fato por trás da manchete', body: context, cta: 'Veja por que importa', duration: 5 }),
      common(2, { category: 'Por que importa', headline: 'O impacto para o investidor', body: impact || detail, cta: 'Continue para o radar', duration: 5 }),
      common(3, { category: 'No radar', headline: 'O que acompanhar a partir de agora', body: radar, cta: 'Salve este Reel', duration: 5 }),
      common(0, { category: 'Fonte', headline: `Informação publicada por ${source}`, body: 'Consulte a matéria original para acompanhar atualizações e o contexto completo.', cta: 'Conteúdo informativo', duration: 3 }),
    ];
  }
  return {
    version: 1, format, active: 0, generatedBy: 'studio-shared-engine',
    originNews: { title, link: String(noticia.link || ''), source },
    slides, caption: buildCaption({ title, summary, source, pillar }),
    editorial: { title, summary, context, detail, pillar, source },
  };
}

function validateStudioProject(project) {
  const blockers = [], warnings = [];
  if (!project || !['feed', 'story', 'carousel', 'reel'].includes(project.format)) blockers.push('formato inválido');
  if (!Array.isArray(project?.slides) || !project.slides.length) blockers.push('projeto sem slides');
  if (project?.format === 'carousel' && project.slides.length < 5) blockers.push('carrossel sem narrativa completa');
  if (project?.format === 'reel' && project.slides.length < 4) blockers.push('Reel sem cenas suficientes');
  for (const [index, slide] of (project?.slides || []).entries()) {
    const combined = `${slide.headline || ''} ${slide.body || ''}`;
    if (String(slide.headline || '').length < 18) blockers.push(`slide ${index + 1} sem manchete clara`);
    if (String(slide.body || '').length < 35) blockers.push(`slide ${index + 1} sem contexto suficiente`);
    if (/https?:\/\/|<[^>]+>|data-(?:image|large)/i.test(combined)) blockers.push(`slide ${index + 1} contém link ou código da página`);
    if (/(?:\.{3}|…)\s*$/.test(String(slide.headline || ''))) blockers.push(`slide ${index + 1} contém manchete cortada`);
    if (!slide.image) blockers.push(`slide ${index + 1} sem imagem editorial`);
    if (!slide.source) warnings.push(`slide ${index + 1} sem fonte visível`);
    if (String(slide.headline || '').length > 150 || String(slide.body || '').length > 300) blockers.push(`slide ${index + 1} excede a área segura`);
  }
  if (!project?.originNews?.source) blockers.push('fonte informativa ausente');
  const score = Math.max(0, 100 - blockers.length * 20 - warnings.length * 5);
  return { approved: blockers.length === 0 && score >= 80, score, blockers, warnings };
}

async function downloadEditorialImages(candidates, limit = 5) {
  const images = [];
  for (const url of [...new Set(candidates.filter(Boolean))]) {
    const image = await baixarImagemBase64(url);
    if (image && !images.includes(image)) images.push(image);
    if (images.length >= limit) break;
  }
  return images;
}

async function prepareStudioProject(noticia, { format = 'feed' } = {}) {
  let article = { imagens: [], blocos: [], texto: '' };
  try { article = await buscarConteudoArtigo(noticia.link); }
  catch (error) { console.log(`Studio Engine: matéria completa indisponível (${error.message}).`); }
  const images = await downloadEditorialImages([...(article.imagens || []), noticia.imagem], format === 'feed' || format === 'story' ? 1 : 5);
  const project = buildStudioProject(noticia, { format, article, images });
  const quality = validateStudioProject(project);
  return { project, quality, article, images };
}

module.exports = {
  PALETTE, IMPACT_BY_PILLAR, RADAR_BY_PILLAR, cleanEditorial, completeText,
  buildStudioProject, validateStudioProject, prepareStudioProject, downloadEditorialImages,
};
