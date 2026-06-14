// Busca cotações (Ibovespa, Dólar, Bitcoin, etc.) via Yahoo Finance (API pública, sem chave).
// Uso: node coletor_cotacoes.cjs   -> imprime JSON com as cotações
//      ou: const { buscarCotacoes } = require('./coletor_cotacoes.cjs')
const ATIVOS = [
  { simbolo: '^BVSP', nome: 'Ibovespa', formato: 'numero' },
  { simbolo: 'BRL=X', nome: 'Dólar', formato: 'moeda_brl' },
  { simbolo: 'BTC-USD', nome: 'Bitcoin', formato: 'moeda_usd' },
];

function formatarValor(valor, formato) {
  if (formato === 'moeda_brl') return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (formato === 'moeda_usd') return 'US$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function buscarCotacao(ativo) {
  try {
    const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ativo.simbolo)}?range=2d&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
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
  } catch (e) {
    console.error(`Erro ao buscar ${ativo.nome}:`, e.message);
    return null;
  }
}

async function buscarCotacoes() {
  const resultados = await Promise.all(ATIVOS.map(buscarCotacao));
  return resultados.filter(Boolean);
}

if (require.main === module) {
  buscarCotacoes().then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { buscarCotacoes };
