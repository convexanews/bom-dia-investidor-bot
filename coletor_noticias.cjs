// Busca manchetes de portais de notícias financeiras (RSS) e filtra apenas
// o que é relevante para o "Bom Dia Investidor" (mercado, economia, ações, etc.)
// Uso: node coletor_noticias.cjs   -> imprime JSON com as notícias filtradas
const cheerio = require('cheerio');

const FONTES = [
  { nome: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },
  { nome: 'Money Times', url: 'https://www.moneytimes.com.br/feed/' },
];

// Palavras-chave que indicam conteúdo de mercado/economia (filtra esportes, famosos, etc.)
const PALAVRAS_RELEVANTES = [
  'mercado', 'bolsa', 'ibovespa', 'ação', 'ações', 'b3', 'dólar', 'real',
  'juros', 'selic', 'inflação', 'ipca', 'pib', 'economia', 'banco central',
  'bc ', 'investimento', 'investidor', 'fundo', 'fii', 'fiis', 'dividendo',
  'bitcoin', 'cripto', 'criptomoeda', 'wall street', 'nasdaq', 'dow jones',
  's&p', 'petrobras', 'vale', 'itaú', 'bradesco', 'taxa', 'fed', 'tesouro',
  'recessão', 'pmi', 'câmbio', 'commodities', 'lucro', 'balanço', 'oferta pública',
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

      itens.push({
        titulo,
        link,
        descricao,
        categorias,
        imagem,
        fonte: fonte.nome,
        pubDate,
        publicadoEm: pubDate ? new Date(pubDate).getTime() : 0,
      });
    });

    return itens;
  } catch (e) {
    console.error(`Erro ao buscar ${fonte.nome}:`, e.message);
    return [];
  }
}

async function buscarNoticias(limite = 10) {
  const listas = await Promise.all(FONTES.map(buscarFonte));
  const todas = listas.flat();
  todas.sort((a, b) => b.publicadoEm - a.publicadoEm);
  return todas.slice(0, limite);
}

if (require.main === module) {
  buscarNoticias().then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { buscarNoticias };
