// Verifica noticias novas do mercado financeiro, gera os cards (feed + stories)
// e publica automaticamente no Instagram "Bom Dia Investidor".
// Roda via GitHub Actions (cron de 1h). Variaveis de ambiente necessarias:
//   IG_TOKEN, IG_ACCOUNT_ID
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buscarNoticias } = require('./coletor_noticias.cjs');
const { gerarCard } = require('./gerar_card_noticia.cjs');

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

  // Limite de 15 posts de notícia por dia (Instagram permite 25/dia; reserva margem para reel e carrossel)
  const MAX_POSTS_DIA = 15;
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

  // Já vem ordenado por peso (impacto) do coletor - pega o mais impactante não postado
  const nova = noticias.find(n => n.link && !postadas.has(n.link) && !tituloJaPostado(n.titulo));

  if (!nova) {
    console.log('Nenhuma noticia nova no momento. Nada a postar.');
    registrarVerificacao('sem_noticia', 'Nenhuma notícia nova encontrada. Nada foi postado.');
    return;
  }

  console.log(`Notícia selecionada (peso ${nova.peso || '?'}): ${nova.titulo}`);
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
  const nomeFeed = `noticia-${ts}-feed.png`;
  const nomeStory = `noticia-${ts}-story.png`;
  await gerarCard(cfg, path.join(cardsDir, nomeFeed));
  await gerarCard({ ...cfg, formato: 'story' }, path.join(cardsDir, nomeStory));

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nomeFeed} bdi-cards/${nomeStory}`, PAGES_DIR);
  git(`git commit -m "Card automatico: ${cfg.manchete.slice(0, 60)}"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  const imageUrl = `${PAGES_RAW_BASE}/${nomeFeed}`;
  const storyImageUrl = `${PAGES_RAW_BASE}/${nomeStory}`;

  // Espera a CDN do raw.githubusercontent liberar o arquivo recem enviado
  await new Promise(r => setTimeout(r, 15000));

  const legenda = montarLegenda(cfg);
  const postId = await publicarFeed(imageUrl, legenda);
  console.log('Publicado no feed! ID:', postId);

  let storyId = null;
  try {
    storyId = await publicarStory(storyImageUrl);
    console.log('Publicado no story! ID:', storyId);
  } catch (e) {
    console.log('Erro ao publicar o story (feed ja foi publicado):', e.message);
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
    imagemFeed: imageUrl,
    imagemStory: storyImageUrl,
  });
  salvarJson(RELATORIO_FILE, relatorio.slice(0, 200));

  registrarVerificacao('postado', `Postagem realizada com sucesso: "${cfg.manchete}".`, { postId, storyId });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro na execucao automatica:', e.message);
  registrarVerificacao('erro', `Erro na execução automática: ${e.message}`);
  process.exit(1);
});
