// Busca as maiores altas do dia entre as principais ações da B3 via Yahoo Finance.
const ACOES_B3 = [
  { ticker: 'PETR4', nome: 'Petrobras PN',     simbolo: 'PETR4.SA' },
  { ticker: 'PETR3', nome: 'Petrobras ON',     simbolo: 'PETR3.SA' },
  { ticker: 'VALE3', nome: 'Vale',             simbolo: 'VALE3.SA' },
  { ticker: 'ITUB4', nome: 'Itaú Unibanco',   simbolo: 'ITUB4.SA' },
  { ticker: 'BBDC4', nome: 'Bradesco PN',      simbolo: 'BBDC4.SA' },
  { ticker: 'BBAS3', nome: 'Banco do Brasil',  simbolo: 'BBAS3.SA' },
  { ticker: 'ABEV3', nome: 'Ambev',            simbolo: 'ABEV3.SA' },
  { ticker: 'WEGE3', nome: 'WEG',              simbolo: 'WEGE3.SA' },
  { ticker: 'RENT3', nome: 'Localiza',         simbolo: 'RENT3.SA' },
  { ticker: 'RDOR3', nome: 'Rede D\'Or',       simbolo: 'RDOR3.SA' },
  { ticker: 'SUZB3', nome: 'Suzano',           simbolo: 'SUZB3.SA' },
  { ticker: 'PRIO3', nome: 'PRIO',             simbolo: 'PRIO3.SA' },
  { ticker: 'GGBR4', nome: 'Gerdau PN',        simbolo: 'GGBR4.SA' },
  { ticker: 'CSNA3', nome: 'CSN',              simbolo: 'CSNA3.SA' },
  { ticker: 'USIM5', nome: 'Usiminas',         simbolo: 'USIM5.SA' },
  { ticker: 'EMBR3', nome: 'Embraer',          simbolo: 'EMBR3.SA' },
  { ticker: 'AZUL4', nome: 'Azul PN',          simbolo: 'AZUL4.SA' },
  { ticker: 'GOLL4', nome: 'Gol PN',           simbolo: 'GOLL4.SA' },
  { ticker: 'MGLU3', nome: 'Magazine Luiza',   simbolo: 'MGLU3.SA' },
  { ticker: 'TOTS3', nome: 'TOTVS',            simbolo: 'TOTS3.SA' },
  { ticker: 'RADL3', nome: 'Raia Drogasil',    simbolo: 'RADL3.SA' },
  { ticker: 'HAPV3', nome: 'Hapvida',          simbolo: 'HAPV3.SA' },
  { ticker: 'CSAN3', nome: 'Cosan',            simbolo: 'CSAN3.SA' },
  { ticker: 'BPAC11', nome: 'BTG Pactual',     simbolo: 'BPAC11.SA' },
  { ticker: 'SANB11', nome: 'Santander BR',    simbolo: 'SANB11.SA' },
  { ticker: 'EQTL3', nome: 'Equatorial',       simbolo: 'EQTL3.SA' },
  { ticker: 'ENEV3', nome: 'Eneva',            simbolo: 'ENEV3.SA' },
  { ticker: 'RAIZ4', nome: 'Raízen PN',        simbolo: 'RAIZ4.SA' },
];

async function buscarAcao(acao) {
  try {
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${acao.simbolo}?range=1d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    const atual = meta.regularMarketPrice;
    const anterior = meta.chartPreviousClose;
    const variacaoPct = ((atual - anterior) / anterior) * 100;
    return {
      ticker: acao.ticker,
      nome: acao.nome,
      preco: 'R$ ' + atual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      variacao: (variacaoPct >= 0 ? '+' : '') + variacaoPct.toFixed(2).replace('.', ',') + '%',
      variacaoNum: variacaoPct,
    };
  } catch {
    return null;
  }
}

async function buscarTopAltasB3(top = 5) {
  const resultados = await Promise.all(ACOES_B3.map(buscarAcao));
  return resultados
    .filter(Boolean)
    .sort((a, b) => b.variacaoNum - a.variacaoNum)
    .slice(0, top);
}

if (require.main === module) {
  buscarTopAltasB3().then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { buscarTopAltasB3 };
