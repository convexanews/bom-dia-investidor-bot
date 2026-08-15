// Busca cotações (Ibovespa, Dólar, Bitcoin, etc.) via Yahoo Finance (API pública, sem chave).
// Fallbacks: BCB (Dólar), CoinGecko (Bitcoin), brapi.dev (Ibovespa).
// Uso: node coletor_cotacoes.cjs   -> imprime JSON com as cotações
//      ou: const { buscarCotacoes } = require('./coletor_cotacoes.cjs')
const ATIVOS = [
  { simbolo: '^BVSP', nome: 'Ibovespa', formato: 'numero' },
  { simbolo: 'BRL=X', nome: 'Dólar', formato: 'moeda_brl' },
  { simbolo: 'BTC-USD', nome: 'Bitcoin', formato: 'moeda_usd' },
];

// Timeout de 5 segundos para todas as requisições
const TIMEOUT_MS = 5000;

function fetchComTimeout(url, opcoes = {}) {
  return fetch(url, {
    ...opcoes,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

function formatarValor(valor, formato) {
  if (formato === 'moeda_brl') return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (formato === 'moeda_usd') return 'US$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// --- Yahoo Finance (fonte principal) ---
async function buscarViaYahoo(ativo) {
  const resp = await fetchComTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ativo.simbolo)}?range=2d&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  const data = await resp.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('Resposta Yahoo sem dados');
  const atual = meta.regularMarketPrice;
  const anterior = meta.chartPreviousClose;
  const variacaoPct = ((atual - anterior) / anterior) * 100;
  const sinal = variacaoPct >= 0 ? '+' : '';
  return {
    nome: ativo.nome,
    valor: formatarValor(atual, ativo.formato),
    variacao: `${sinal}${variacaoPct.toFixed(2).replace('.', ',')}%`,
    variacaoNum: variacaoPct,
  };
}

// --- Fallback Dólar: API do Banco Central (PTAX) ---
async function buscarDolarBCB() {
  const resp = await fetchComTimeout(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/2?formato=json'
  );
  const dados = await resp.json();
  if (!Array.isArray(dados) || dados.length < 2) throw new Error('BCB retornou dados insuficientes');
  const anterior = parseFloat(dados[0].valor);
  const atual = parseFloat(dados[1].valor);
  const variacaoPct = ((atual - anterior) / anterior) * 100;
  const sinal = variacaoPct >= 0 ? '+' : '';
  return {
    nome: 'Dólar',
    valor: formatarValor(atual, 'moeda_brl'),
    variacao: `${sinal}${variacaoPct.toFixed(2).replace('.', ',')}%`,
    variacaoNum: variacaoPct,
  };
}

// --- Fallback Bitcoin: CoinGecko ---
async function buscarBitcoinCoinGecko() {
  const resp = await fetchComTimeout(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
  );
  const dados = await resp.json();
  const btc = dados?.bitcoin;
  if (!btc) throw new Error('CoinGecko retornou dados inválidos');
  const atual = btc.usd;
  const variacaoPct = btc.usd_24h_change ?? 0;
  const sinal = variacaoPct >= 0 ? '+' : '';
  return {
    nome: 'Bitcoin',
    valor: formatarValor(atual, 'moeda_usd'),
    variacao: `${sinal}${variacaoPct.toFixed(2).replace('.', ',')}%`,
    variacaoNum: variacaoPct,
  };
}

// --- Fallback Ibovespa: brapi.dev ---
async function buscarIbovespaBrapi() {
  const resp = await fetchComTimeout(
    'https://brapi.dev/api/quote/%5EBVSP'
  );
  const dados = await resp.json();
  const resultado = dados?.results?.[0];
  if (!resultado) throw new Error('brapi.dev retornou dados inválidos');
  const atual = resultado.regularMarketPrice;
  const variacaoPct = resultado.regularMarketChangePercent ?? 0;
  const sinal = variacaoPct >= 0 ? '+' : '';
  return {
    nome: 'Ibovespa',
    valor: formatarValor(atual, 'numero'),
    variacao: `${sinal}${variacaoPct.toFixed(2).replace('.', ',')}%`,
    variacaoNum: variacaoPct,
  };
}

// Mapa de fallbacks por nome do ativo
const FALLBACKS = {
  'Dólar': buscarDolarBCB,
  'Bitcoin': buscarBitcoinCoinGecko,
  'Ibovespa': buscarIbovespaBrapi,
};

async function buscarCotacao(ativo) {
  // Tenta Yahoo Finance primeiro
  try {
    return await buscarViaYahoo(ativo);
  } catch (erroYahoo) {
    console.error(`Yahoo falhou para ${ativo.nome}: ${erroYahoo.message}`);
  }

  // Tenta fallback específico do ativo
  const fallback = FALLBACKS[ativo.nome];
  if (fallback) {
    try {
      console.log(`Usando fallback para ${ativo.nome}...`);
      return await fallback();
    } catch (erroFallback) {
      console.error(`Fallback também falhou para ${ativo.nome}: ${erroFallback.message}`);
    }
  }

  return null;
}

async function buscarCotacoes() {
  const resultados = await Promise.all(ATIVOS.map(buscarCotacao));
  return resultados.filter(Boolean);
}

if (require.main === module) {
  buscarCotacoes().then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { buscarCotacoes };
