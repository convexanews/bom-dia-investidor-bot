// Verifica noticias novas do mercado financeiro, gera os cards (feed + stories)
// e publica automaticamente no Instagram "Bom Dia Investidor".
// Roda via GitHub Actions (cron de 1h). Variaveis de ambiente necessarias:
//   IG_TOKEN, IG_ACCOUNT_ID
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buscarNoticias } = require('./coletor_noticias.cjs');
const { gerarCard } = require('./gerar_card_noticia.cjs');
const { gerarVideoTikTok, montarLegendaTikTok } = require('./gerar_tiktok.cjs');

const PESO_MINIMO_REEL = 30;
const TIKTOK_POSTADAS_FILE = path.join(__dirname, 'tiktok-postadas.json');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

const POSTADAS_FILE = path.join(__dirname, 'noticias-postadas.json');
const RELATORIO_FILE = path.join(__dirname, 'relatorio.json');
const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

function carregarJson(arquivo, padrao) {
  try {
    if (fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch {}
  return padrao;
}

function salvarJson(arquivo, dados) {
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

async function buscarImagemArtigo(link) {
  if (!link) return null;
  try {
    const resp = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await resp.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match ? match[1] : null;
  } catch (e) {
    console.log('Erro ao buscar imagem do artigo:', e.message);
    return null;
  }
}

const HASHTAGS = '#investimentos #bolsadevalores #ibovespa #mercadofinanceiro #dolar #economiabrasileira #acoes #b3 #educacaofinanceira #financas #investidor #independenciafinanceira #trading #noticias #mercado';

const CTAS = [
  '💬 Comente o que você acha disso!',
  '📌 Salve para não perder essa informação!',
  '👇 Marque um amigo investidor!',
  '🔔 Ative as notificações para não perder nada!',
  '🤔 Concorda? Comente abaixo!',
];

function montarLegenda(cfg) {
  const cta = CTAS[Math.floor(Date.now() / 1000) % CTAS.length];
  const base = `${cfg.manchete}\n\n${cfg.resumo || ''}\n\nFonte: ${cfg.fonte || ''}`;
  return `${base}\n\n${cta}\n\n📊 Fique por dentro de mais notícias do mercado financeiro: https://bomdiainvestidor.com.br/\n\n${HASHTAGS}`;
}

function estaNoHorarioPico() {
  const hora = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  return hora >= 6 && hora < 22;
}

async function aguardarContainerPronto(containerId, tentativas = 15) {
  for (let i = 0; i < tentativas; i++) {
    const resp = await fetch(`${IG_API_BASE}/${containerId}?fields=status_code&access_token=${IG_TOKEN}`);
    const data = await resp.json();
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') throw new Error('Container com erro: ' + JSON.stringify(data));
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Timeout esperando o container ficar pronto: ' + containerId);
}

async function publicarFeed(imageUrl, legenda) {
  const createUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`;
  const createResp = await fetch(createUrl, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container do feed: ' + JSON.stringify(createData));

  await aguardarContainerPronto(createData.id);
  const publishUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${createData.id}&access_token=${IG_TOKEN}`;
  const publishResp = await fetch(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar no feed: ' + JSON.stringify(publishData));
  return publishData.id;
}

async function publicarReel(videoUrl, legenda) {
  const createUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?media_type=REELS&video_url=${encodeURIComponent(videoUrl)}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`;
  const createResp = await fetch(createUrl, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container do reel: ' + JSON.stringify(createData));

  await aguardarContainerPronto(createData.id, 60);
  const publishUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${createData.id}&access_token=${IG_TOKEN}`;
  const publishResp = await fetch(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar reel: ' + JSON.stringify(publishData));
  return publishData.id;
}

async function publicarStory(imageUrl) {
  const createUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&media_type=STORIES&access_token=${IG_TOKEN}`;
  const createResp = await fetch(createUrl, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container de stories: ' + JSON.stringify(createData));

  await aguardarContainerPronto(createData.id);
  const publishUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${createData.id}&access_token=${IG_TOKEN}`;
  const publishResp = await fetch(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar story: ' + JSON.stringify(publishData));
  return publishData.id;
}

function git(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function registrarVerificacao(resultado, mensagem, extra = {}) {
  const verificacoes = carregarJson(VERIFICACOES_FILE, []);
  verificacoes.unshift({ data: new Date().toISOString(), resultado, mensagem, ...extra });
  salvarJson(VERIFICACOES_FILE, verificacoes.slice(0, 200));
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) {
    throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID nas variaveis de ambiente/secrets.');
  }

  const postadas = new Set(carregarJson(POSTADAS_FILE, []));
  const relatorio = carregarJson(RELATORIO_FILE, []);

  if (!estaNoHorarioPico()) {
    const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    console.log(`Fora do horário de postagem (${hora} BRT). Postagens acontecem entre 06h e 22h.`);
    registrarVerificacao('fora_horario', `Verificação fora do horário de pico (${hora} BRT). Postagens ocorrem entre 06h e 22h.`);
    return;
  }

  // Intervalo mínimo de 2h entre posts (evita spam, melhora alcance)
  const INTERVALO_MIN_MS = 2 * 60 * 60 * 1000;
  const ultimoPost = relatorio.find(p => p.origem !== 'manual');
  if (ultimoPost) {
    const tempoDesdeUltimo = Date.now() - new Date(ultimoPost.data).getTime();
    if (tempoDesdeUltimo < INTERVALO_MIN_MS) {
      const minRestantes = Math.ceil((INTERVALO_MIN_MS - tempoDesdeUltimo) / 60000);
      console.log(`Último post há ${Math.floor(tempoDesdeUltimo / 60000)} min. Próximo em ${minRestantes} min (intervalo de 2h).`);
      registrarVerificacao('aguardando_intervalo', `Aguardando intervalo de 2h entre posts. Faltam ${minRestantes} min.`);
      return;
    }
  }

  // Máximo 8 posts por dia (06h-22h = 16h / 2h = 8 posts)
  const MAX_POSTS_DIA = 8;
  const inicioDia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  inicioDia.setHours(0, 0, 0, 0);
  const postasHoje = relatorio.filter(p =>
    p.origem !== 'manual' && new Date(p.data) >= inicioDia
  ).length;
  if (postasHoje >= MAX_POSTS_DIA) {
    console.log(`Limite diário atingido (${postasHoje}/${MAX_POSTS_DIA} posts hoje). Nada a postar.`);
    registrarVerificacao('limite_diario', `Limite de ${MAX_POSTS_DIA} posts diários atingido (${postasHoje} já publicados hoje).`);
    return;
  }

  const noticias = await buscarNoticias();

  // Títulos já postados (para evitar duplicatas por assunto, não só por link)
  const titulosPostados = relatorio.map(r => (r.titulo || '').toLowerCase());

  function tituloJaPostado(titulo) {
    const norm = titulo.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const palavras = new Set(norm.split(' ').filter(w => w.length > 3));
    return titulosPostados.some(tp => {
      const normTp = tp.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      const pTp = new Set(normTp.split(' ').filter(w => w.length > 3));
      if (pTp.size === 0 || palavras.size === 0) return false;
      let comuns = 0;
      for (const w of palavras) { if (pTp.has(w)) comuns++; }
      return (comuns / Math.min(palavras.size, pTp.size)) >= 0.7;
    });
  }

  // Filtra apenas notícias das últimas 1h e não postadas, já ordenadas por peso (impacto)
  const UMA_HORA_MS = 60 * 60 * 1000;
  const agora = Date.now();
  const candidatas = noticias.filter(n =>
    n.link &&
    !postadas.has(n.link) &&
    !tituloJaPostado(n.titulo) &&
    n.publicadoEm > 0 &&
    (agora - n.publicadoEm) <= UMA_HORA_MS
  );

  // Se não houver notícia nova na última 1h, não posta (evita conteúdo desatualizado)
  const nova = candidatas[0] || null;

  if (!nova) {
    console.log('Nenhuma noticia nova na última 1h. Nada a postar.');
    registrarVerificacao('sem_noticia', 'Nenhuma notícia nova na última hora. Nada foi postado.');
    return;
  }

  console.log(`Notícia selecionada (peso ${nova.peso}): ${nova.titulo}`);
  registrarVerificacao('noticia_encontrada', `Notícia nova encontrada (peso ${nova.peso || '?'}): "${nova.titulo}". Realizando postagem...`);

  const cfg = {
    categoria: (nova.categorias && nova.categorias[0]) || 'MERCADO',
    manchete: nova.titulo,
    resumo: (nova.descricao || '').replace(/\[…\]|\[&#8230;\]/g, '').trim(),
    fonte: nova.fonte,
    link: nova.link,
    imagem: nova.imagem || null,
  };
  if (!cfg.imagem) {
    cfg.imagem = await buscarImagemArtigo(cfg.link);
  }

  console.log('Nova noticia:', cfg.manchete);

  // Clona o repo do GitHub Pages para publicar as imagens dos cards
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN (PAT com acesso de escrita ao repo do GitHub Pages).');
  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token:${pagesToken}@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);

  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ts = Date.now();
  const ehAltoImpacto = (nova.peso || 0) >= PESO_MINIMO_REEL;
  const legenda = montarLegenda(cfg);
  let postId = null;
  let storyId = null;
  let reelId = null;
  let videoUrl = null;
  let imageUrl = null;
  let storyImageUrl = null;

  if (ehAltoImpacto) {
    // === REEL NARRADO (alto impacto) ===
    console.log(`Alto impacto (peso ${nova.peso}) — gerando Reel narrado + TikTok...`);

    const nomeVideo = `reel-${ts}.mp4`;
    const videoLocal = path.join(__dirname, 'output', nomeVideo);
    await gerarVideoTikTok(cfg, videoLocal);

    // Salva vídeo no GitHub Pages
    const tiktokDir = path.join(PAGES_DIR, 'bdi-tiktok');
    if (!fs.existsSync(tiktokDir)) fs.mkdirSync(tiktokDir, { recursive: true });
    fs.copyFileSync(videoLocal, path.join(tiktokDir, nomeVideo));

    const legendaTikTok = montarLegendaTikTok(cfg);
    const legendaFile = `reel-${ts}-legenda.txt`;
    fs.writeFileSync(path.join(tiktokDir, legendaFile), legendaTikTok, 'utf8');

    git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
    git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
    git(`git add bdi-tiktok/${nomeVideo} bdi-tiktok/${legendaFile}`, PAGES_DIR);
    git(`git commit -m "Reel narrado: ${cfg.manchete.slice(0, 50)}"`, PAGES_DIR);
    git('git push', PAGES_DIR);

    videoUrl = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-tiktok/${nomeVideo}`;
    await new Promise(r => setTimeout(r, 20000));

    reelId = await publicarReel(videoUrl, legenda);
    console.log('Reel narrado publicado no Instagram! ID:', reelId);
    postId = reelId;

    // Registra no tiktok-postadas.json pra download manual no TikTok
    const tiktokPostadas = carregarJson(TIKTOK_POSTADAS_FILE, []);
    tiktokPostadas.unshift({
      titulo: nova.titulo,
      link: nova.link,
      peso: nova.peso,
      videoUrl,
      legendaUrl: `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-tiktok/${legendaFile}`,
      data: new Date().toISOString(),
    });
    salvarJson(TIKTOK_POSTADAS_FILE, tiktokPostadas.slice(0, 200));

  } else {
    // === CARD ESTÁTICO (impacto normal) ===
    const nomeFeed = `noticia-${ts}-feed.png`;
    const nomeStory = `noticia-${ts}-story.png`;
    await gerarCard(cfg, path.join(cardsDir, nomeFeed));
    await gerarCard({ ...cfg, formato: 'story' }, path.join(cardsDir, nomeStory));

    git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
    git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
    git(`git add bdi-cards/${nomeFeed} bdi-cards/${nomeStory}`, PAGES_DIR);
    git(`git commit -m "Card automatico: ${cfg.manchete.slice(0, 60)}"`, PAGES_DIR);
    git('git push', PAGES_DIR);

    imageUrl = `${PAGES_RAW_BASE}/${nomeFeed}`;
    storyImageUrl = `${PAGES_RAW_BASE}/${nomeStory}`;
    await new Promise(r => setTimeout(r, 15000));

    postId = await publicarFeed(imageUrl, legenda);
    console.log('Publicado no feed! ID:', postId);

    try {
      storyId = await publicarStory(storyImageUrl);
      console.log('Publicado no story! ID:', storyId);
    } catch (e) {
      console.log('Erro ao publicar o story (feed ja foi publicado):', e.message);
    }
  }

  postadas.add(nova.link);
  salvarJson(POSTADAS_FILE, [...postadas]);

  relatorio.unshift({
    data: new Date().toISOString(),
    titulo: cfg.manchete,
    categoria: cfg.categoria,
    fonte: cfg.fonte,
    link: cfg.link,
    postId,
    storyId,
    reelId,
    imagemFeed: imageUrl,
    imagemStory: storyImageUrl,
    videoUrl,
    tipo: ehAltoImpacto ? 'reel_narrado' : 'card',
  });
  salvarJson(RELATORIO_FILE, relatorio.slice(0, 200));

  registrarVerificacao('postado', `Postagem realizada com sucesso (${ehAltoImpacto ? 'reel narrado' : 'card'}): "${cfg.manchete}".`, { postId, storyId, reelId, tipo: ehAltoImpacto ? 'reel_narrado' : 'card' });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro na execucao automatica:', e.message);
  registrarVerificacao('erro', `Erro na execução automática: ${e.message}`);
  process.exit(1);
});
