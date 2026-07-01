// Gera e publica carrossel de fechamento do mercado às 18h BRT:
// Slide 1 — Ibovespa, Dólar, Bitcoin com variação do dia
// Slide 2 — Top 5 maiores altas da B3
// Roda via GitHub Actions. Vars necessárias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');
const { buscarCotacoes } = require('./coletor_cotacoes.cjs');
const { buscarTopAltasB3 } = require('./coletor_acoes_b3.cjs');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

const DIAS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function dataExtensoBRT() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function corVariacao(num) {
  return num >= 0
    ? { cor: '#059669', bg: '#ecfdf5' }
    : { cor: '#dc2626', bg: '#fef2f2' };
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

async function gerarCardPng(templateFile, substituicoes, saida, altura = 1350) {
  let html = fs.readFileSync(path.join(__dirname, templateFile), 'utf8');
  for (const [chave, valor] of Object.entries(substituicoes)) {
    html = html.replaceAll(chave, valor);
  }
  const tmpHtml = path.join(__dirname, `_tmp_${templateFile}`);
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: altura });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: altura } });
  await browser.close();
  fs.unlinkSync(tmpHtml);
}

async function aguardarContainerPronto(id, tentativas = 30) {
  for (let i = 0; i < tentativas; i++) {
    const resp = await fetch(`${IG_API_BASE}/${id}?fields=status_code&access_token=${IG_TOKEN}`);
    const data = await resp.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Container com erro: ' + JSON.stringify(data));
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Timeout aguardando container: ' + id);
}

async function criarItemCarrossel(imageUrl) {
  const resp = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&is_carousel_item=true&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const data = await resp.json();
  if (!data.id) throw new Error('Erro ao criar item do carrossel: ' + JSON.stringify(data));
  await aguardarContainerPronto(data.id);
  return data.id;
}

async function publicarCarrossel(imageUrls, legenda) {
  const childIds = [];
  for (const url of imageUrls) {
    childIds.push(await criarItemCarrossel(url));
  }

  const resp = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?media_type=CAROUSEL&children=${childIds.join(',')}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const data = await resp.json();
  if (!data.id) throw new Error('Erro ao criar container do carrossel: ' + JSON.stringify(data));

  await aguardarContainerPronto(data.id);

  const pub = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${data.id}&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const pubData = await pub.json();
  if (!pubData.id) throw new Error('Erro ao publicar carrossel: ' + JSON.stringify(pubData));
  return pubData.id;
}

const HASHTAGS = '#investimentos #bolsadevalores #ibovespa #mercadofinanceiro #dolar #acoes #b3 #educacaofinanceira #financas #investidor #trading #fechamentob3 #maioresaltas #mercado #economiabrasileira';

const CTAS = [
  '💬 Qual ação te surpreendeu hoje? Comente!',
  '📌 Salve para acompanhar o mercado!',
  '👇 Marque um amigo investidor!',
  '🔔 Ative as notificações para não perder nada!',
];

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN.');

  console.log('Buscando cotações e top altas da B3...');
  const [cotacoes, altas] = await Promise.all([buscarCotacoes(), buscarTopAltasB3(5)]);

  if (!cotacoes.length) throw new Error('Não foi possível buscar as cotações.');
  if (altas.length < 3) throw new Error('Menos de 3 ações disponíveis. Mercado pode estar fechado.');

  const ibov  = cotacoes.find(c => c.nome === 'Ibovespa') || {};
  const dolar = cotacoes.find(c => c.nome === 'Dólar')    || {};
  const btc   = cotacoes.find(c => c.nome === 'Bitcoin')   || {};

  const ibovCor  = corVariacao(ibov.variacaoNum  || 0);
  const dolarCor = corVariacao(dolar.variacaoNum || 0);
  const btcCor   = corVariacao(btc.variacaoNum   || 0);

  const data = dataExtensoBRT();
  const ts = Date.now();

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const nomeFechamento = `fechamento-${ts}.png`;
  const nomeAltas = `altas-${ts}.png`;

  const altasFill = (altas.length >= 5 ? altas : [...altas, ...Array(5).fill({ ticker:'—', nome:'—', preco:'—', variacao:'—', variacaoNum:0 })]).slice(0, 5);
  const altasCores = altasFill.map(a => corVariacao(a.variacaoNum || 0));

  console.log('Gerando card de fechamento...');
  await gerarCardPng('card-fechamento.html', {
    '{{DATA_EXTENSO}}': data,
    '{{IBOV_VALOR}}':  ibov.valor  || '—',
    '{{IBOV_VAR}}':   ibov.variacao  || '—',
    '{{IBOV_COR}}':   ibovCor.cor,
    '{{IBOV_BG}}':    ibovCor.bg,
    '{{DOLAR_VALOR}}': dolar.valor || '—',
    '{{DOLAR_VAR}}':  dolar.variacao || '—',
    '{{DOLAR_COR}}':  dolarCor.cor,
    '{{DOLAR_BG}}':   dolarCor.bg,
    '{{BTC_VALOR}}':  btc.valor   || '—',
    '{{BTC_VAR}}':    btc.variacao || '—',
    '{{BTC_COR}}':    btcCor.cor,
    '{{BTC_BG}}':     btcCor.bg,
  }, path.join(cardsDir, nomeFechamento));

  console.log('Gerando card de maiores altas...');
  const subsAltas = { '{{DATA_EXTENSO}}': data };
  altasFill.forEach((a, i) => {
    const n = i + 1;
    subsAltas[`{{A${n}_TICKER}}`] = a.ticker;
    subsAltas[`{{A${n}_NOME}}`]   = a.nome;
    subsAltas[`{{A${n}_PRECO}}`]  = a.preco;
    subsAltas[`{{A${n}_VAR}}`]    = a.variacao;
    subsAltas[`{{A${n}_COR}}`]    = altasCores[i].cor;
    subsAltas[`{{A${n}_BG}}`]     = altasCores[i].bg;
  });
  await gerarCardPng('card-altas.html', subsAltas, path.join(cardsDir, nomeAltas));

  console.log('Enviando imagens para o GitHub Pages...');
  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nomeFechamento} bdi-cards/${nomeAltas}`, PAGES_DIR);
  git(`git commit -m "Carrossel fechamento ${new Date().toISOString().slice(0,10)}"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  await new Promise(r => setTimeout(r, 15000));

  const urlFechamento = `${PAGES_RAW_BASE}/${nomeFechamento}`;
  const urlAltas      = `${PAGES_RAW_BASE}/${nomeAltas}`;

  const cta = CTAS[Math.floor(ts / 1000) % CTAS.length];
  const titulos = altas.map((a, i) => `${i + 1}. ${a.ticker} (${a.variacao})`).join('\n');
  const legenda = `📊 Fechamento do mercado — ${data}\n\nIbovespa: ${ibov.valor} ${ibov.variacao}\nDólar: ${dolar.valor} ${dolar.variacao}\nBitcoin: ${btc.valor} ${btc.variacao}\n\n🔥 Maiores altas da B3:\n${titulos}\n\n${cta}\n\n📈 Mais notícias em: https://bomdiainvestidor.com.br/\n\n${HASHTAGS}`;

  console.log('Publicando carrossel no Instagram...');
  const postId = await publicarCarrossel([urlFechamento, urlAltas], legenda);
  console.log('Carrossel publicado! ID:', postId);

  registrarVerificacao('carrossel_fechamento', `Carrossel de fechamento publicado. Ibovespa: ${ibov.valor} ${ibov.variacao}`, {
    postId,
    ibov: { valor: ibov.valor, variacao: ibov.variacao },
    topAltas: altas.map(a => `${a.ticker} ${a.variacao}`),
  });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao gerar/publicar carrossel de fechamento:', e.message);
  registrarVerificacao('erro_carrossel_fechamento', `Erro ao publicar carrossel de fechamento: ${e.message}`);
  process.exit(1);
});
