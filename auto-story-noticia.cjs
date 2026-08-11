// Publica Stories de notícias recentes de menor impacto a cada ciclo editorial.
// O feed fica reservado a Reels de maior impacto editorial.
const fs = require('fs');
const path = require('path');
const { criarCapaRetencao } = require('./formato_editorial.cjs');
const { git } = require('./git-seguro.cjs');
const { buscarImagemArtigo, baixarImagemBase64 } = require('./imagem_noticia.cjs');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const STORIES_FILE = path.join(__dirname, 'stories-postadas.json');
const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');

const PESO_MINIMO_STORY = 30;
const PESO_MAXIMO_STORY = 59;
const JANELA_NOTICIA_STORY_MS = 2 * 60 * 60 * 1000;

function carregarJson(arquivo, padrao) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return padrao; }
}
function salvarJson(arquivo, dados) {
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}
function registrarVerificacao(resultado, mensagem, extra = {}) {
  const verificacoes = carregarJson(VERIFICACOES_FILE, []);
  verificacoes.unshift({ data: new Date().toISOString(), resultado, mensagem, ...extra });
  salvarJson(VERIFICACOES_FILE, verificacoes.slice(0, 200));
}

function selecionarNoticiaStory(noticias, linksPostados, agora = Date.now()) {
  return noticias.find(n =>
    n.link &&
    !linksPostados.has(n.link) &&
    n.publicadoEm > 0 &&
    agora - n.publicadoEm <= JANELA_NOTICIA_STORY_MS &&
    n.peso >= PESO_MINIMO_STORY &&
    n.peso <= PESO_MAXIMO_STORY
  ) || null;
}

async function validarToken() {
  const resposta = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}?fields=id&access_token=${IG_TOKEN}`);
  const dados = await resposta.json();
  if (resposta.ok && dados.id) return true;
  const erro = dados?.error || {};
  registrarVerificacao('token_invalido_story', `Story pausado: token inválido (${erro.code || 'sem código'}).`);
  return false;
}

async function publicarStory(imageUrl) {
  const criar = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&media_type=STORIES&access_token=${IG_TOKEN}`, { method: 'POST' });
  const container = await criar.json();
  if (!container.id) throw new Error(`Erro ao criar Story: ${JSON.stringify(container)}`);
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const status = await fetch(`${IG_API_BASE}/${container.id}?fields=status_code&access_token=${IG_TOKEN}`);
    const dados = await status.json();
    if (dados.status_code === 'FINISHED') break;
    if (dados.status_code === 'ERROR') throw new Error(`Story com erro: ${JSON.stringify(dados)}`);
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
  const publicar = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${container.id}&access_token=${IG_TOKEN}`, { method: 'POST' });
  const dados = await publicar.json();
  if (!dados.id) throw new Error(`Erro ao publicar Story: ${JSON.stringify(dados)}`);
  return dados.id;
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID || !process.env.PAGES_TOKEN) throw new Error('Defina IG_TOKEN, IG_ACCOUNT_ID e PAGES_TOKEN.');
  if (!await validarToken()) return;
  const { buscarNoticias } = require('./coletor_noticias.cjs');
  const { gerarCard } = require('./gerar_card_noticia.cjs');

  const registros = carregarJson(STORIES_FILE, []);
  const noticia = selecionarNoticiaStory(await buscarNoticias(), new Set(registros.map(r => r.link)));
  if (!noticia) {
    registrarVerificacao('sem_noticia_story', 'Nenhuma notícia recente de menor impacto foi encontrada.');
    return;
  }

  const capa = criarCapaRetencao(noticia.titulo, (noticia.categorias || [])[0]);
  const imagemOriginal = noticia.imagem || await buscarImagemArtigo(noticia.link);
  const imagem = await baixarImagemBase64(imagemOriginal);
  if (!imagem) {
    registrarVerificacao('story_sem_imagem', `Story publicado sem imagem editorial: "${noticia.titulo}".`, { link: noticia.link });
  }
  const cfg = {
    formato: 'story',
    categoria: (noticia.categorias || [])[0] || 'MERCADO',
    manchete: noticia.titulo,
    mancheteVisual: capa.gancho,
    fonte: noticia.fonte,
    imagem,
    pergunta: 'Veja o que acompanhar no mercado hoje.',
  };
  const nome = `story-noticia-${Date.now()}.png`;
  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  fs.mkdirSync(cardsDir, { recursive: true });
  await gerarCard(cfg, path.join(cardsDir, nome));
  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nome}`, PAGES_DIR);
  git(`git commit -m "Story notícia: ${noticia.titulo.slice(0, 50)}"`, PAGES_DIR);
  git('git push', PAGES_DIR);
  const imageUrl = `${PAGES_RAW_BASE}/${nome}`;
  await new Promise(resolve => setTimeout(resolve, 15000));
  const postId = await publicarStory(imageUrl);
  registros.unshift({ data: new Date().toISOString(), link: noticia.link, titulo: noticia.titulo, peso: noticia.peso, postId });
  salvarJson(STORIES_FILE, registros.slice(0, 200));
  registrarVerificacao('story_noticia_postado', `Story publicado (peso ${noticia.peso}): "${noticia.titulo}".`, { postId, peso: noticia.peso });
  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

if (require.main === module) {
  main().catch(erro => {
    console.error('Erro ao publicar Story de notícia:', erro.message);
    registrarVerificacao('erro_story_noticia', erro.message);
    process.exit(1);
  });
}

module.exports = { selecionarNoticiaStory, PESO_MINIMO_STORY, PESO_MAXIMO_STORY, JANELA_NOTICIA_STORY_MS };
