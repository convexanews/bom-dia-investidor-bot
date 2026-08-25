// Utilitários compartilhados por todos os scripts do bot.
// Centraliza: JSON, verificações, fetch com retry, publicação no Instagram e git.
const fs = require('fs');
const path = require('path');

const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const RELATORIO_FILE = path.join(__dirname, 'relatorio.json');

// ── JSON ────────────────────────────────────────────────────────────────────

function carregarJson(arquivo, padrao) {
  try {
    if (fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch {}
  return padrao;
}

function salvarJson(arquivo, dados) {
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

// ── Verificações ────────────────────────────────────────────────────────────

function registrarVerificacao(resultado, mensagem, extra = {}) {
  const verificacoes = carregarJson(VERIFICACOES_FILE, []);
  verificacoes.unshift({ data: new Date().toISOString(), resultado, mensagem, ...extra });
  salvarJson(VERIFICACOES_FILE, verificacoes.slice(0, 200));
}

// ── Fetch com retry e backoff exponencial ───────────────────────────────────
// Protege contra instabilidades da Graph API, rate limits (429) e erros
// transitórios (5xx). Sem isso, um pico de latência perde o post inteiro.

async function fetchComRetry(url, opts = {}, { tentativas = 3, baseMs = 2000 } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetch(url, opts);
      // Rate limit ou erro de servidor: espera e tenta de novo
      if (resp.status === 429 || resp.status >= 500) {
        const espera = baseMs * Math.pow(2, i);
        console.log(`  Retry ${i + 1}/${tentativas}: HTTP ${resp.status}, aguardando ${espera}ms...`);
        await new Promise(r => setTimeout(r, espera));
        continue;
      }
      return resp;
    } catch (erro) {
      ultimoErro = erro;
      if (i < tentativas - 1) {
        const espera = baseMs * Math.pow(2, i);
        console.log(`  Retry ${i + 1}/${tentativas}: ${erro.message}, aguardando ${espera}ms...`);
        await new Promise(r => setTimeout(r, espera));
      }
    }
  }
  throw ultimoErro || new Error(`Falha após ${tentativas} tentativas`);
}

// ── Instagram Graph API ─────────────────────────────────────────────────────

const IG_API_BASE = 'https://graph.instagram.com/v23.0';

function igToken() { return process.env.IG_TOKEN; }
function igAccountId() { return process.env.IG_ACCOUNT_ID; }

async function validarTokenInstagram() {
  try {
    const resp = await fetchComRetry(`${IG_API_BASE}/${igAccountId()}?fields=id&access_token=${igToken()}`);
    const data = await resp.json();
    if (resp.ok && data.id) return true;
    const erro = data?.error || {};
    if (erro.code === 190) {
      const verificacoes = carregarJson(VERIFICACOES_FILE, []);
      const jaAlertado = verificacoes.some(v =>
        v.resultado === 'token_invalido' &&
        Date.now() - new Date(v.data).getTime() < 12 * 60 * 60 * 1000
      );
      if (!jaAlertado) {
        registrarVerificacao('token_invalido', 'Publicação pausada: IG_TOKEN inválido ou expirado. Atualize o segredo no GitHub Actions.', { codigo: erro.code });
      }
      return false;
    }
    throw new Error(`Não foi possível validar o token: ${JSON.stringify(data)}`);
  } catch (erro) {
    registrarVerificacao('falha_validacao_token', `Publicação pausada por falha na validação do token: ${erro.message}`);
    return false;
  }
}

async function aguardarContainerPronto(containerId, tentativas = 15) {
  for (let i = 0; i < tentativas; i++) {
    const resp = await fetchComRetry(`${IG_API_BASE}/${containerId}?fields=status_code&access_token=${igToken()}`);
    const data = await resp.json();
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') throw new Error('Container com erro: ' + JSON.stringify(data));
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Timeout esperando o container ficar pronto: ' + containerId);
}

// Gera alt text descritivo para o Instagram (SEO + Explore + acessibilidade).
function gerarAltText(cfg) {
  const tipo = cfg.tipo || 'notícia';
  const manchete = (cfg.manchete || '').slice(0, 200);
  const fonte = cfg.fonte || '';
  return `Card de ${tipo} financeira: ${manchete}.${fonte ? ` Fonte: ${fonte}.` : ''} Bom Dia Investidor.`.slice(0, 420);
}

async function publicarFeed(imageUrl, legenda, { altText } = {}) {
  let url = `${IG_API_BASE}/${igAccountId()}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(legenda)}&access_token=${igToken()}`;
  if (altText) url += `&alt_text_tag=${encodeURIComponent(altText)}`;
  const createResp = await fetchComRetry(url, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container do feed: ' + JSON.stringify(createData));

  await aguardarContainerPronto(createData.id);
  const publishUrl = `${IG_API_BASE}/${igAccountId()}/media_publish?creation_id=${createData.id}&access_token=${igToken()}`;
  const publishResp = await fetchComRetry(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar no feed: ' + JSON.stringify(publishData));
  return publishData.id;
}

async function publicarReel(videoUrl, legenda, { shareToFeed = true, coverUrl = '', thumbOffset = 0 } = {}) {
  const params = new URLSearchParams({
    media_type: 'REELS', video_url: videoUrl, caption: legenda,
    share_to_feed: shareToFeed ? 'true' : 'false', access_token: igToken(),
  });
  if (coverUrl) params.set('cover_url', coverUrl);
  if (Number(thumbOffset) > 0) params.set('thumb_offset', String(Math.floor(Number(thumbOffset))));
  const createUrl = `${IG_API_BASE}/${igAccountId()}/media?${params}`;
  const createResp = await fetchComRetry(createUrl, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container do reel: ' + JSON.stringify(createData));

  await aguardarContainerPronto(createData.id, 60);
  const publishUrl = `${IG_API_BASE}/${igAccountId()}/media_publish?creation_id=${createData.id}&access_token=${igToken()}`;
  const publishResp = await fetchComRetry(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar reel: ' + JSON.stringify(publishData));
  return publishData.id;
}

async function publicarStory(mediaUrl, { video = false } = {}) {
  const mediaParam = video ? 'video_url' : 'image_url';
  const createUrl = `${IG_API_BASE}/${igAccountId()}/media?${mediaParam}=${encodeURIComponent(mediaUrl)}&media_type=STORIES&access_token=${igToken()}`;
  const createResp = await fetchComRetry(createUrl, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container de stories: ' + JSON.stringify(createData));

  await aguardarContainerPronto(createData.id);
  const publishUrl = `${IG_API_BASE}/${igAccountId()}/media_publish?creation_id=${createData.id}&access_token=${igToken()}`;
  const publishResp = await fetchComRetry(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar story: ' + JSON.stringify(publishData));
  return publishData.id;
}

async function criarItemCarrossel(imageUrl, { altText } = {}) {
  let url = `${IG_API_BASE}/${igAccountId()}/media?image_url=${encodeURIComponent(imageUrl)}&is_carousel_item=true&access_token=${igToken()}`;
  if (altText) url += `&alt_text_tag=${encodeURIComponent(altText)}`;
  const resp = await fetchComRetry(url, { method: 'POST' });
  const data = await resp.json();
  if (!data.id) throw new Error('Erro ao criar item do carrossel: ' + JSON.stringify(data));
  return data.id;
}

async function publicarCarrossel(imageUrls, legenda, { altTexts = [] } = {}) {
  const childIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const altText = altTexts[i] || undefined;
    childIds.push(await criarItemCarrossel(imageUrls[i], { altText }));
  }

  const resp = await fetchComRetry(
    `${IG_API_BASE}/${igAccountId()}/media?media_type=CAROUSEL&children=${childIds.join(',')}&caption=${encodeURIComponent(legenda)}&access_token=${igToken()}`,
    { method: 'POST' }
  );
  const data = await resp.json();
  if (!data.id) throw new Error('Erro ao criar carrossel: ' + JSON.stringify(data));

  await aguardarContainerPronto(data.id);

  const pub = await fetchComRetry(
    `${IG_API_BASE}/${igAccountId()}/media_publish?creation_id=${data.id}&access_token=${igToken()}`,
    { method: 'POST' }
  );
  const pubData = await pub.json();
  if (!pubData.id) throw new Error('Erro ao publicar carrossel: ' + JSON.stringify(pubData));
  return pubData.id;
}

// Consulta os últimos posts publicados no Instagram — fonte da verdade
// definitiva contra duplicatas.
async function buscarCaptionsRecentes() {
  try {
    const resp = await fetchComRetry(`${IG_API_BASE}/${igAccountId()}/media?fields=caption,timestamp&limit=25&access_token=${igToken()}`);
    const data = await resp.json();
    const DOIS_DIAS_MS = 48 * 60 * 60 * 1000;
    return (data.data || [])
      .filter(m => m.caption && (Date.now() - new Date(m.timestamp).getTime()) < DOIS_DIAS_MS)
      .map(m => m.caption.split('\n')[0].trim())
      .filter(Boolean);
  } catch (e) {
    console.log('Aviso: não foi possível consultar posts recentes do Instagram:', e.message);
    return [];
  }
}

// ── GitHub Pages ────────────────────────────────────────────────────────────

const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

function pagesDir() { return path.join(__dirname, 'pages-repo'); }

function clonePages() {
  const dir = pagesDir();
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  const { git } = require('./git-seguro.cjs');
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${dir}"`, __dirname);
  const cardsDir = path.join(dir, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });
  return { dir, cardsDir };
}

function commitEPush(mensagem, arquivos) {
  const dir = pagesDir();
  const { git } = require('./git-seguro.cjs');
  git('git config user.email "bot@bomdiainvestidor.com.br"', dir);
  git('git config user.name "Bom Dia Investidor Bot"', dir);
  git(`git add ${arquivos.join(' ')}`, dir);
  const { execFileSync } = require('child_process');
  execFileSync('git', ['commit', '-m', mensagem], { cwd: dir, stdio: 'inherit' });
  git('git push', dir);
}

function limparPages() {
  const dir = pagesDir();
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = {
  carregarJson,
  salvarJson,
  registrarVerificacao,
  fetchComRetry,
  validarTokenInstagram,
  aguardarContainerPronto,
  gerarAltText,
  publicarFeed,
  publicarReel,
  publicarStory,
  criarItemCarrossel,
  publicarCarrossel,
  buscarCaptionsRecentes,
  clonePages,
  commitEPush,
  limparPages,
  pagesDir,
  PAGES_REPO,
  PAGES_RAW_BASE,
  IG_API_BASE,
  VERIFICACOES_FILE,
  RELATORIO_FILE,
};
