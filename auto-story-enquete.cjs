// Publica story de enquete diária às 6h BRT.
// Design visual de poll que incentiva comentários e engajamento.
// Vars necessárias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { renderizarTemplate } = require('./renderizar_template.cjs');
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

function diaSemanaIndex() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return d.getDay(); // 0 = domingo, 1 = segunda...
}

// Banco completo de enquetes vive em storys-templates.cjs (também usado pelo painel de Storys).
const TEMPLATES = require('./storys-templates.cjs');

// Enquetes rotativas por dia da semana (mapeadas para slugs do banco compartilhado)
const ROTACAO_SEMANAL = {
  0: 'investe-toda-semana', // Domingo
  1: 'ibov-semana',         // Segunda
  2: 'dolar-hoje',          // Terça
  3: 'renda-fixa-variavel', // Quarta
  4: 'tem-cripto',          // Quinta
  5: 'investir-salario',    // Sexta
  6: 'tem-fii',             // Sábado
};

const ENQUETES = Object.fromEntries(
  Object.entries(ROTACAO_SEMANAL).map(([dia, slug]) => [dia, TEMPLATES.find(t => t.slug === slug)])
);

const { git } = require('./git-seguro.cjs');

async function gerarStoryEnquete(enquete, data, saida) {
  let html = fs.readFileSync(path.join(__dirname, 'card-story-enquete.html'), 'utf8');
  const subs = {
    '{{ICONE}}': enquete.icone,
    '{{PERGUNTA}}': enquete.pergunta,
    '{{ICONE_A}}': enquete.iconeA,
    '{{OPCAO_A}}': enquete.opcaoA,
    '{{ICONE_B}}': enquete.iconeB,
    '{{OPCAO_B}}': enquete.opcaoB,
    '{{DATA}}': data,
  };
  for (const [k, v] of Object.entries(subs)) html = html.replaceAll(k, v);

  return renderizarTemplate({ html, saida, largura: 1080, altura: 1920, nome: 'story_enquete' });
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN.');

  const enquete = ENQUETES[diaSemanaIndex()];
  const data = dataHojeBRT();
  console.log(`Enquete do dia: ${enquete.pergunta}`);

  const ts = Date.now();
  const nomeStory = `enquete-${ts}.png`;

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  console.log('Gerando story de enquete...');
  await gerarStoryEnquete(enquete, data, path.join(cardsDir, nomeStory));

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nomeStory}`, PAGES_DIR);
  git(`git commit -m "Story enquete ${data}"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  await new Promise(r => setTimeout(r, 15000));

  const url = `${PAGES_RAW_BASE}/${nomeStory}`;

  console.log('Publicando story de enquete no Instagram...');
  const postId = await publicarStory(url);
  console.log('Story de enquete publicado! ID:', postId);

  registrarVerificacao('story_enquete', `Story de enquete publicado: "${enquete.pergunta}"`, { postId });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao publicar story de enquete:', e.message);
  registrarVerificacao('erro_story_enquete', `Erro ao publicar story de enquete: ${e.message}`);
  process.exit(1);
});
