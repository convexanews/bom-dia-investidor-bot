// Publica Stories de notícias recentes de menor impacto a cada ciclo editorial.
// O feed fica reservado aos formatos de maior impacto editorial.
const fs = require('fs');
const path = require('path');
const { git } = require('./git-seguro.cjs');
const { prepareStudioProject } = require('./studio-content-engine.cjs');
const { renderStudioSlide } = require('./studio-renderer-cloud.cjs');
const { carregarJson, salvarJson, registrarVerificacao, publicarStory, PAGES_REPO, PAGES_RAW_BASE, IG_API_BASE } = require('./utils.cjs');

const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const STORIES_FILE = path.join(__dirname, 'stories-postadas.json');

const PESO_MINIMO_STORY = 30;
const PESO_MAXIMO_STORY = 69;
const JANELA_NOTICIA_STORY_MS = 2 * 60 * 60 * 1000;

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

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID || !process.env.PAGES_TOKEN) throw new Error('Defina IG_TOKEN, IG_ACCOUNT_ID e PAGES_TOKEN.');
  if (!await validarToken()) return;
  const { buscarNoticias } = require('./coletor_noticias.cjs');

  const registros = carregarJson(STORIES_FILE, []);
  const noticia = selecionarNoticiaStory(await buscarNoticias(), new Set(registros.map(r => r.link)));
  if (!noticia) {
    registrarVerificacao('sem_noticia_story', 'Nenhuma notícia recente de menor impacto foi encontrada.');
    return;
  }

  const prepared = await prepareStudioProject(noticia, { format: 'story' });
  if (!prepared.quality.approved) {
    registrarVerificacao('story_reprovado_studio', `Story bloqueado pelo Studio Engine (nota ${prepared.quality.score}): ${prepared.quality.blockers.join('; ')}.`, { link: noticia.link });
    return;
  }
  const project = prepared.project;
  const nome = `story-noticia-${Date.now()}.png`;
  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  fs.mkdirSync(cardsDir, { recursive: true });
  await renderStudioSlide(project, 0, path.join(cardsDir, nome));
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
