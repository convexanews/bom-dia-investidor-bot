// Publica um story por dia explicando um termo financeiro, rotacionando
// pelo banco em glossario-templates.cjs (não repete até passar por todos).
// Vars necessarias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');
const TERMOS = require('./glossario-templates.cjs');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function dataHojeBRT() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function diaDoAnoBRT() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const inicio = new Date(d.getFullYear(), 0, 0);
  const diff = d - inicio;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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

async function gerarImagem(termo, data, saida) {
  let html = fs.readFileSync(path.join(__dirname, 'card-story-glossario.html'), 'utf8');
  const subs = {
    '{{ICONE}}': termo.icone,
    '{{TERMO}}': termo.termo,
    '{{DEFINICAO}}': termo.definicao,
    '{{EXEMPLO}}': termo.exemplo,
    '{{DATA}}': data,
  };
  for (const [k, v] of Object.entries(subs)) html = html.split(k).join(v);

  const tmpHtml = path.join(__dirname, '_tmp_story_glossario.html');
  fs.writeFileSync(tmpHtml, html, 'utf8');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await browser.close();
  fs.unlinkSync(tmpHtml);
}

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

async function publicarStory(imageUrl) {
  const resp = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&media_type=STORIES&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const data = await resp.json();
  if (!data.id) throw new Error('Erro ao criar container de stories: ' + JSON.stringify(data));
  await aguardarContainerPronto(data.id);
  const pub = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${data.id}&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const pubData = await pub.json();
  if (!pubData.id) throw new Error('Erro ao publicar story: ' + JSON.stringify(pubData));
  return pubData.id;
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN.');

  const termo = TERMOS[diaDoAnoBRT() % TERMOS.length];
  const data = dataHojeBRT();
  console.log(`Termo do dia: ${termo.termo}`);

  const ts = Date.now();
  const nomeImg = `glossario-${ts}.png`;

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  console.log('Gerando story do glossário...');
  await gerarImagem(termo, data, path.join(cardsDir, nomeImg));

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nomeImg}`, PAGES_DIR);
  git(`git commit -m "Glossario: ${termo.termo}"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  await new Promise(r => setTimeout(r, 15000));
  const url = `${PAGES_RAW_BASE}/${nomeImg}`;

  console.log('Publicando story do glossário no Instagram...');
  const postId = await publicarStory(url);
  console.log('Story do glossário publicado! ID:', postId);

  registrarVerificacao('story_glossario', `Story do glossário publicado: "${termo.termo}"`, { postId });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao publicar story do glossário:', e.message);
  registrarVerificacao('erro_story_glossario', `Erro ao publicar story do glossário: ${e.message}`);
  process.exit(1);
});
