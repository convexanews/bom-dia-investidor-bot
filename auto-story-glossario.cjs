// Publica um story por dia explicando um termo financeiro, rotacionando
// pelo banco em glossario-templates.cjs (não repete até passar por todos).
// Vars necessarias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { renderizarTemplate } = require('./renderizar_template.cjs');
const TERMOS = require('./glossario-templates.cjs');
const { carregarJson, salvarJson, registrarVerificacao, publicarStory } = require('./utils.cjs');

const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
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

  return renderizarTemplate({ html, saida, largura: 1080, altura: 1920, nome: 'story_glossario' });
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
