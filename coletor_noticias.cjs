// Busca manchetes de portais de notícias financeiras (RSS) e filtra apenas
// o que é relevante para o "Bom Dia Investidor" (mercado, economia, ações, etc.)
// Uso: node coletor_noticias.cjs   -> imprime JSON com as notícias filtradas
const cheerio = require('cheerio');

const FONTES = [
  { nome: 'InfoMoney',       url: 'https://www.infomoney.com.br/feed/' },
  { nome: 'Money Times',     url: 'https://www.moneytimes.com.br/feed/' },
  { nome: 'Suno',            url: 'https://www.suno.com.br/noticias/feed/' },
  { nome: 'Exame',           url: 'https://exame.com/feed/' },
  { nome: 'Exame Invest',    url: 'https://exame.com/invest/feed/' },
  { nome: 'CNN Brasil',      url: 'https://www.cnnbrasil.com.br/economia/feed/' },
  { nome: 'Investing.com',   url: 'https://br.investing.com/rss/news.rss' },
  { nome: 'Valor Econômico', url: 'https://valor.globo.com/rss/financas/index.xml' },
  { nome: 'Bloomberg Línea', url: 'https://www.bloomberglinea.com.br/feed/' },
  { nome: 'Reuters Brasil',  url: 'https://br.reuters.com/rssFeed/businessNews' },
  { nome: 'G1 Economia',     url: 'https://g1.globo.com/rss/g1/economia/' },
];

// Palavras-chave que indicam conteúdo de mercado/economia (filtra esportes, famosos, etc.)
const PALAVRAS_RELEVANTES = [
  'mercado', 'bolsa', 'ibovespa', 'ação', 'ações', 'b3', 'dólar', 'real',
  'juros', 'selic', 'inflação', 'ipca', 'pib', 'economia', 'banco central',
  'bc ', 'investimento', 'investidor', 'fundo', 'fii', 'fiis', 'dividendo',
  'bitcoin', 'cripto', 'criptomoeda', 'wall street', 'nasdaq', 'dow jones',
  's&p', 'petrobras', 'vale', 'itaú', 'bradesco', 'taxa', 'fed', 'tesouro',
  'recessão', 'pmi', 'câmbio', 'commodities', 'lucro', 'balanço', 'oferta pública',
  'copom', 'etf', 'renda fixa', 'renda variável', 'cdi', 'ipca+', 'rendimento',
  'preço', 'alta', 'queda', 'dispara', 'despenca', 'recorde', 'crise',
  'eua', 'china', 'europa', 'trump', 'lula', 'haddad', 'campos neto',
  'petróleo', 'ouro', 'minério', 'soja', 'agro', 'energia',
  'spacex', 'tesla', 'apple', 'nvidia', 'microsoft', 'amazon', 'google',
  'irã', 'guerra', 'acordo', 'sanção', 'tarifa', 'importação', 'exportação',
  'emprego', 'desemprego', 'salário', 'renda', 'consumo', 'varejo',
  'imóvel', 'imobiliário', 'aluguel', 'financiamento', 'crédito',
  'banco', 'fintech', 'nubank', 'pix', 'drex', 'regulação',
  'reforma', 'tributária', 'fiscal', 'orçamento', 'déficit', 'superávit',
  'ipr', 'suzano', 'weg', 'ambev', 'magazine', 'luiza', 'magalu',
];

function decodeEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .trim();
}

// Peso alto = notícia que mexe forte no mercado / bolso do investidor
const PESO_ALTO = [
  'selic', 'copom', 'fed', 'juros', 'inflação', 'ipca', 'pib',
  'ibovespa', 'b3', 'wall street', 'nasdaq', 'dow jones', 's&p',
  'dólar', 'câmbio', 'recessão', 'crise',
  'banco central', 'campos neto', 'haddad',
  'guerra', 'sanção', 'acordo', 'tarifa',
  'recorde', 'dispara', 'despenca', 'tomba', 'derrete', 'crash',
  'reforma tributária', 'fiscal',
  'petrobras', 'vale', 'itaú', 'bradesco',
  'bitcoin', 'spacex', 'nvidia', 'tesla', 'apple',
  'ipo', 'fusão', 'aquisição', 'oferta pública',
];

// Peso médio = relevante mas menos urgente
const PESO_MEDIO = [
  'mercado', 'bolsa', 'ação', 'ações', 'economia',
  'dividendo', 'fii', 'fiis', 'fundo', 'etf',
  'investimento', 'investidor', 'rendimento',
  'lucro', 'balanço', 'resultado',
  'petróleo', 'ouro', 'minério', 'commodities',
  'emprego', 'desemprego', 'salário', 'varejo', 'consumo',
  'dólar', 'real', 'taxa',
  'eua', 'china', 'europa', 'trump', 'lula',
  'banco', 'crédito', 'financiamento',
];

function calcularPesoImpacto(titulo, descricao, categorias) {
  const texto = (titulo + ' ' + (descricao || '') + ' ' + categorias.join(' ')).toLowerCase();
  let peso = 0;

  for (const p of PESO_ALTO) {
    if (texto.includes(p)) peso += 10;
  }
  for (const p of PESO_MEDIO) {
    if (texto.includes(p)) peso += 3;
  }

  // Bônus: título com palavras de urgência/impacto
  const tituloLower = titulo.toLowerCase();
  if (/urgente|breaking|alerta|última hora/.test(tituloLower)) peso += 20;
  if (/dispara|despenca|recorde|crash|tomba|derrete|surpreende/.test(tituloLower)) peso += 15;
  if (/sobe mais de \d|cai mais de \d|alta de \d|queda de \d/.test(tituloLower)) peso += 12;

  // Bônus por múltiplas fontes cobrindo o mesmo tema (será calculado externamente)
  // Penalidade leve por notícia muito antiga (>12h)
  return peso;
}

function pareceRelevante(titulo, categorias) {
  const texto = (titulo + ' ' + categorias.join(' ')).toLowerCase();
  return PALAVRAS_RELEVANTES.some(p => texto.includes(p));
}

async function buscarFonte(fonte) {
  try {
    const resp = await fetch(fonte.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await resp.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const itens = [];

    $('item').each((_, el) => {
      const titulo = decodeEntities($(el).find('title').first().text());
      const link = $(el).find('link').first().text().trim();
      const pubDate = $(el).find('pubDate').first().text().trim();
      const categorias = $(el).find('category').map((__, c) => decodeEntities($(c).text())).get();
      let descricaoHtml = $(el).find('description').first().text();
      const descricao = decodeEntities(descricaoHtml.replace(/<[^>]+>/g, '')).slice(0, 400);

      // Extrai a imagem de capa da notícia (maior resolução disponível no <img> embutido)
      const conteudoHtml = descricaoHtml + ' ' + $(el).find('content\\:encoded').first().text();
      let imagem = null;
      const matchOrig = conteudoHtml.match(/data-orig-file="([^"]+)"/);
      const matchSrc = conteudoHtml.match(/<img[^>]+src="([^"]+)"/);
      if (matchOrig) imagem = decodeEntities(matchOrig[1]);
      else if (matchSrc) imagem = decodeEntities(matchSrc[1]);

      if (!titulo || !pareceRelevante(titulo, categorias)) return;

      const publicadoEm = pubDate ? new Date(pubDate).getTime() : 0;
      const peso = calcularPesoImpacto(titulo, descricao, categorias);

      itens.push({
        titulo,
        link,
        descricao,
        categorias,
        imagem,
        fonte: fonte.nome,
        pubDate,
        publicadoEm,
        peso,
      });
    });

    return itens;
  } catch (e) {
    console.error(`Erro ao buscar ${fonte.nome}:`, e.message);
    return [];
  }
}

function normalizarTexto(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titulosSimilares(a, b) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (na === nb) return true;
  // Checa se um contém >70% das palavras do outro
  const pa = new Set(na.split(' ').filter(w => w.length > 3));
  const pb = new Set(nb.split(' ').filter(w => w.length > 3));
  if (pa.size === 0 || pb.size === 0) return false;
  let comuns = 0;
  for (const w of pa) { if (pb.has(w)) comuns++; }
  const menor = Math.min(pa.size, pb.size);
  return (comuns / menor) >= 0.7;
}

async function buscarNoticias(limite = 30) {
  const listas = await Promise.all(FONTES.map(buscarFonte));
  const todas = listas.flat();

  // Bônus: se múltiplas fontes cobrem o mesmo tema, aumenta o peso
  for (let i = 0; i < todas.length; i++) {
    let cobertura = 0;
    for (let j = 0; j < todas.length; j++) {
      if (i !== j && titulosSimilares(todas[i].titulo, todas[j].titulo)) cobertura++;
    }
    if (cobertura > 0) todas[i].peso += cobertura * 8;
  }

  // Penalidade por notícia velha (>12h perde peso gradualmente)
  const agora = Date.now();
  for (const n of todas) {
    if (n.publicadoEm > 0) {
      const horasAtras = (agora - n.publicadoEm) / (1000 * 60 * 60);
      if (horasAtras > 12) n.peso -= Math.floor(horasAtras - 12) * 2;
    }
  }

  // Ordena por peso (impacto) decrescente; desempate por data mais recente
  todas.sort((a, b) => b.peso - a.peso || b.publicadoEm - a.publicadoEm);

  // Remove duplicatas (mesmo assunto de fontes diferentes)
  const unicas = [];
  for (const n of todas) {
    const jaTem = unicas.some(u => titulosSimilares(u.titulo, n.titulo));
    if (!jaTem) unicas.push(n);
  }

  return unicas.slice(0, limite);
}

if (require.main === module) {
  buscarNoticias().then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { buscarNoticias };
