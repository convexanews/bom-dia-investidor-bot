// Publica todo sábado um card "quanto custava há 1 ano" comparando
// Ibovespa, Dólar e Bitcoin de hoje com o mesmo dia do ano passado.
// Vars necessarias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const ATIVOS = [
  { simbolo: '^BVSP', nome: 'Ibovespa', prefixo: 'IBOV', formato: 'numero' },
  { simbolo: 'BRL=X', nome: 'Dólar', prefixo: 'DOLAR', formato: 'moeda_brl' },
  { simbolo: 'BTC-USD', nome: 'Bitcoin', prefixo: 'BTC', formato: 'moeda_usd' },
];

function formatarValor(valor, formato) {
  if (formato === 'moeda_brl') return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (formato === 'moeda_usd') return 'US$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function dataHojeBRT() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

async function buscarComparativo(ativo) {
  const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ativo.simbolo)}?range=1y&interval=1d`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const hoje = result.meta.regularMarketPrice;
  const closes = result.indicators?.quote?.[0]?.close || [];
  // Primeiro valor válido da serie de 1 ano = preço de ~1 ano atrás
  const antigoIdx = closes.findIndex(c => c != null);
  const antigo = antigoIdx >= 0 ? closes[antigoIdx] : null;
  if (antigo == null) return null;

  const variacaoPct = ((hoje - antigo) / antigo) * 100;
  const sinal = variacaoPct >= 0 ? '+' : '';
  return {
    nome: ativo.nome,
    prefixo: ativo.prefixo,
    antigo: formatarValor(antigo, ativo.formato),
    hoje: formatarValor(hoje, ativo.formato),
    variacao: `${sinal}${variacaoPct.toFixed(1).replace('.', ',')}%`,
    positivo: variacaoPct >= 0,
  };
}

function carregarJson(arquivo, padrao) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return padrao; }
}
function salvarJson(arquivo, dados) {
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}
function registrarVerificacao(resultado, mensagem, extra = {}) {
  const v = carregarJson(VERIFICACOES_FILE, []);
  v.unshift({ data: new Date().toISOString(), resultado, mensagem, ...extra });
  salvarJson(VERIFICACOES_FILE, v.slice(0, 200));
}
const { git } = require('./git-seguro.cjs');

async function aguardarContainerPronto(id, tentativas = 20) {
  for (let i = 0; i < tentativas; i++) {
    const resp = await fetch(`${IG_API_BASE}/${id}?fields=status_code&access_token=${IG_TOKEN}`);
    const data = await resp.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Container com erro: ' + JSON.stringify(data));
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Timeout aguardando container: ' + id);
}

async function publicarFeed(imageUrl, legenda) {
  const createUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`;
  const createResp = await fetch(createUrl, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container: ' + JSON.stringify(createData));
  await aguardarContainerPronto(createData.id);
  const publishUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${createData.id}&access_token=${IG_TOKEN}`;
  const publishResp = await fetch(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar: ' + JSON.stringify(publishData));
  return publishData.id;
}

async function gerarImagem(dados, data, saida) {
  let html = fs.readFileSync(path.join(__dirname, 'card-comparativo.html'), 'utf8');
  const subs = {
    '{{DATA_EXTENSO}}': data,
    '{{IBOV_ANTIGO}}': dados.ibov.antigo, '{{IBOV_HOJE}}': dados.ibov.hoje, '{{IBOV_VAR}}': dados.ibov.variacao,
    '{{IBOV_COR}}': dados.ibov.positivo ? '#00a35a' : '#dc2626', '{{IBOV_BG}}': dados.ibov.positivo ? 'rgba(0,170,90,0.1)' : 'rgba(220,38,38,0.08)',
    '{{DOLAR_ANTIGO}}': dados.dolar.antigo, '{{DOLAR_HOJE}}': dados.dolar.hoje, '{{DOLAR_VAR}}': dados.dolar.variacao,
    '{{DOLAR_COR}}': dados.dolar.positivo ? '#00a35a' : '#dc2626', '{{DOLAR_BG}}': dados.dolar.positivo ? 'rgba(0,170,90,0.1)' : 'rgba(220,38,38,0.08)',
    '{{BTC_ANTIGO}}': dados.btc.antigo, '{{BTC_HOJE}}': dados.btc.hoje, '{{BTC_VAR}}': dados.btc.variacao,
    '{{BTC_COR}}': dados.btc.positivo ? '#00a35a' : '#dc2626', '{{BTC_BG}}': dados.btc.positivo ? 'rgba(0,170,90,0.1)' : 'rgba(220,38,38,0.08)',
  };
  for (const [k, v] of Object.entries(subs)) html = html.split(k).join(v);

  const tmpHtml = path.join(__dirname, '_tmp_comparativo.html');
  fs.writeFileSync(tmpHtml, html, 'utf8');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await browser.close();
  fs.unlinkSync(tmpHtml);
}

function montarLegenda(dados) {
  return `📅 Quanto custava há 1 ano?\n\n📈 Ibovespa: ${dados.ibov.antigo} → ${dados.ibov.hoje} (${dados.ibov.variacao})\n💵 Dólar: ${dados.dolar.antigo} → ${dados.dolar.hoje} (${dados.dolar.variacao})\n₿ Bitcoin: ${dados.btc.antigo} → ${dados.btc.hoje} (${dados.btc.variacao})\n\nO que isso te diz sobre o seu dinheiro parado? 🤔\n\n📊 Fique por dentro: https://bomdiainvestidor.com.br/\n\n#mercadofinanceiro #investimentos #ibovespa #dolar #bitcoin`;
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN.');

  console.log('Buscando cotações de hoje e de 1 ano atrás...');
  const [ibov, dolar, btc] = await Promise.all(ATIVOS.map(buscarComparativo));
  if (!ibov || !dolar || !btc) throw new Error('Não foi possível obter as cotações comparativas.');

  const dados = { ibov, dolar, btc };
  const data = dataHojeBRT();
  const ts = Date.now();
  const nomeImg = `comparativo-${ts}.png`;

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  console.log('Gerando card comparativo...');
  await gerarImagem(dados, data, path.join(cardsDir, nomeImg));

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nomeImg}`, PAGES_DIR);
  git(`git commit -m "Comparativo de precos: ${data}"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  const url = `${PAGES_RAW_BASE}/${nomeImg}`;
  await new Promise(r => setTimeout(r, 15000));

  console.log('Publicando comparativo no Instagram...');
  const postId = await publicarFeed(url, montarLegenda(dados));
  console.log('Comparativo publicado! ID:', postId);

  registrarVerificacao('comparativo_precos', `Comparativo de preços publicado. Ibovespa ${ibov.variacao}, Dólar ${dolar.variacao}, Bitcoin ${btc.variacao}.`, { postId });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao publicar comparativo de preços:', e.message);
  registrarVerificacao('erro_comparativo_precos', `Erro ao publicar comparativo de preços: ${e.message}`);
  process.exit(1);
});
