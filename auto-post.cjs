// Verifica noticias novas do mercado financeiro, gera os cards (feed + stories)
// e publica automaticamente no Instagram "Bom Dia Investidor".
// Roda via GitHub Actions (cron de 1h). Variaveis de ambiente necessarias:
//   IG_TOKEN, IG_ACCOUNT_ID
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { buscarNoticias, titulosSimilares } = require('./coletor_noticias.cjs');
const { gerarCard } = require('./gerar_card_noticia.cjs');
const { gerarSlide } = require('./gerar_slide_carrossel.cjs');
const { gerarVideoTikTok, montarLegendaTikTok } = require('./gerar_tiktok.cjs');
const { criarCapaRetencao } = require('./formato_editorial.cjs');
const { avaliarCarrossel, montarNarrativaImpacto } = require('./qualidade_carrossel.cjs');
const { validarPautaAutomatica } = require('./qualidade_editorial.cjs');
const { buscarImagemArtigo, baixarImagemBase64 } = require('./imagem_noticia.cjs');
const { PESO_MINIMO_FEED, selecionarFormatoFeed } = require('./formato_publicacao.cjs');
const { validarNoticiaParaPublicacao } = require('./qualidade_publicacao.cjs');
const { podePublicarFeed } = require('./controle_publicacao.cjs');

// Feed: só notícia de grande impacto, para não competir com Stories.
const PESO_MINIMO_PUBLICACAO = PESO_MINIMO_FEED;
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

// Estratégia de hashtags em 3 camadas (misturar volumes melhora alcance):
// 1. Gigantes (milhões de posts) — visibilidade ampla, rotacionam por dia
// 2. Por assunto — casam com o conteúdo da notícia, onde o algoritmo
//    realmente entrega pra quem se interessa pelo tema
// 3. Nicho/comunidade — menor volume, mais chance de ranquear no topo
const HASHTAGS_GIGANTES = [
  '#investimentos #educacaofinanceira #investidorbrasileiro',
  '#mercadofinanceiro #economiabrasileira #mercadohoje',
];

const HASHTAGS_POR_ASSUNTO = {
  selic:    '#selic #rendafixa #tesourodireto #cdb #jurosaltos',
  dolar:    '#dolar #cambio #dolarhoje #economiabrasileira #moeda',
  bitcoin:  '#bitcoin #criptomoedas #btc #cripto #blockchain',
  fii:      '#fiis #fundosimobiliarios #dividendos #rendapassiva #vivaderenda',
  dividendo:'#dividendos #rendapassiva #vivaderenda #buyandhold #carteiradeinvestimentos',
  positivo: '#bolsadevalores #ibovespa #acoes #b3 #investidorbrasileiro',
  negativo: '#bolsadevalores #ibovespa #crise #protecaopatrimonial #gestaoderisco',
  padrao:   '#mercadofinanceiro #bolsadevalores #ibovespa #acoes #b3',
};

const HASHTAGS_NICHO = [
  '#bomdiainvestidor #investidorbrasileiro #noticiasdomercado #mercadohoje #analisedemercado',
  '#investidoriniciante #aprenderainvestir #vidadeinvestidor #jornadafinanceira #dicasdeinvestimento',
];

// 5 hashtags no total — desde 2024/25 o Instagram prioriza palavras-chave na
// legenda; listas longas de hashtags diluem o sinal e parecem spam. O ideal
// atual é 3-5 tags muito relevantes ao conteúdo.
function escolherHashtags(tipoSentimento = 'padrao') {
  const diaDoAno = Math.floor(Date.now() / 86400000);
  const assunto = (HASHTAGS_POR_ASSUNTO[tipoSentimento] || HASHTAGS_POR_ASSUNTO.padrao).split(' ').slice(0, 3);
  const gigantes = HASHTAGS_GIGANTES[diaDoAno % HASHTAGS_GIGANTES.length].split(' ');
  const nichos = HASHTAGS_NICHO[diaDoAno % HASHTAGS_NICHO.length].split(' ');
  const gigante = gigantes[diaDoAno % gigantes.length];
  const nicho = nichos[diaDoAno % nichos.length];
  return [...assunto, gigante, nicho].join(' ');
}

// Compartilhamento via DM é o sinal mais forte do algoritmo (Adam Mosseri),
// seguido de salvamentos — os CTAs priorizam essas duas ações.
const CTAS = [
  '📌 Salve para revisar este cenário depois.',
  '📤 Envie para quem acompanha esse mercado.',
  '💬 Isso muda sua leitura do cenário? Conte nos comentários.',
];

const SENTIMENTOS = [
  { palavras: ['sobe', 'alta', 'suba', 'subiu', 'dispara', 'recorde', 'lucro', 'cresce', 'crescimento', 'recupera', 'valoriza', 'positivo', 'melhora', 'ganho', 'alta histórica'],
    tipo: 'positivo',
    gradiente: 'linear-gradient(135deg, #00C853, #00BFA5)',
    cor: '#00C853', texto: '#023a1d' },
  { palavras: ['cai', 'queda', 'crise', 'despenca', 'derrete', 'tomba', 'recuo', 'perde', 'baixa', 'desaba', 'recessão', 'crash', 'negativo', 'piora', 'déficit'],
    tipo: 'negativo',
    gradiente: 'linear-gradient(135deg, #FF4444, #E53935)',
    cor: '#FF4444', texto: '#fff' },
];

const PERGUNTAS = {
  positivo: 'Você está aproveitando essa alta? 👇',
  negativo: 'Como você está se protegendo? Comente! 👇',
  selic:    'Isso muda sua estratégia de renda fixa? 👇',
  dolar:    'Você já se protegeu da variação cambial? 👇',
  bitcoin:  'Você tem cripto na carteira? 👇',
  fii:      'Você tem FIIs na carteira? Comente! 👇',
  dividendo:'Você vive de dividendos? Conta pra gente! 👇',
  padrao:   'O que você acha disso? Comente! 👇',
};

const CONTEXTOS = {
  positivo: '📈 O que acompanhar: veja se o movimento se sustenta nos próximos dados e resultados.',
  negativo: '📉 O que acompanhar: observe os próximos dados antes de tomar decisões sobre a carteira.',
  selic:    '💰 O que isso significa para você: rendimento do Tesouro Selic e CDBs pode ser impactado.',
  dolar:    '💵 O que isso significa para você: quem tem ativos dolarizados ou viagem planejada precisa ficar atento.',
  bitcoin:  '₿ O que isso significa para você: criptomoedas seguem voláteis — ajuste a exposição ao seu perfil de risco.',
  fii:      '🏢 O que isso significa para você: fundos imobiliários podem reagir a essa notícia.',
  dividendo:'💸 O que isso significa para você: investidores de renda podem ser diretamente impactados.',
  exterior: '🌎 O que isso significa para você: bolsas globais e juros externos podem influenciar o humor do mercado local.',
  padrao:   '💡 O que acompanhar: observe os próximos dados e seus possíveis impactos no mercado.',
};

function detectarSentimento(titulo, resumo = '') {
  const texto = (titulo + ' ' + resumo).toLowerCase();

  if (/wall street|nasdaq|dow jones|s&p|fed|treasur|oriente m[eé]dio/.test(texto))
    return { tipo: 'exterior', gradiente: 'linear-gradient(135deg, #1565C0, #283593)', cor: '#1565C0', texto: '#fff' };
  if (/selic|copom|juros|taxa básica|renda fixa|tesouro/.test(texto))
    return { tipo: 'selic', gradiente: 'linear-gradient(135deg, #7C4DFF, #651FFF)', cor: '#7C4DFF', texto: '#fff' };
  if (/dólar|câmbio|real|moeda|euro|libra/.test(texto))
    return { tipo: 'dolar', gradiente: 'linear-gradient(135deg, #0288D1, #0277BD)', cor: '#0288D1', texto: '#fff' };
  if (/bitcoin|cripto|ethereum|blockchain/.test(texto))
    return { tipo: 'bitcoin', gradiente: 'linear-gradient(135deg, #FF9100, #E65100)', cor: '#FF9100', texto: '#fff' };
  if (/fii|fundo imobiliário|fundo imobiliario/.test(texto))
    return { tipo: 'fii', gradiente: 'linear-gradient(135deg, #26A69A, #00897B)', cor: '#26A69A', texto: '#fff' };
  if (/dividendo|proventos|jcp|rendimento/.test(texto))
    return { tipo: 'dividendo', gradiente: 'linear-gradient(135deg, #5C6BC0, #3949AB)', cor: '#5C6BC0', texto: '#fff' };

  for (const s of SENTIMENTOS) {
    if (s.palavras.some(p => texto.includes(p)))
      return { tipo: s.tipo, gradiente: s.gradiente, cor: s.cor, texto: s.texto };
  }

  return { tipo: 'padrao', gradiente: 'linear-gradient(135deg, #00D184, #00A8E8)', cor: '#00D184', texto: '#04150f' };
}

function montarLegenda(cfg) {
  const cta = CTAS[Math.floor(Date.now() / 1000) % CTAS.length];
  cfg.cta = cta;
  const contexto = CONTEXTOS[cfg.sentimento?.tipo || 'padrao'] || CONTEXTOS.padrao;
  const resumo = (cfg.resumo || '').replace(/\s+/g, ' ').trim().slice(0, 360);
  return `📌 ${cfg.manchete}\n\nO que aconteceu:\n${resumo}\n\n${contexto}\n\nFonte: ${cfg.fonte || 'não informada'}.\n\n${cta}\n\nConteúdo informativo; não é recomendação de investimento.\n\n${escolherHashtags(cfg.sentimento?.tipo)}`;
}

function estaNoHorarioPico() {
  const hora = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  return hora >= 6 && hora <= 22;
}

// Evita uma sequência de falhas de publicação quando o segredo expira.
// A validação é leve e, com token inválido, o workflow encerra sem tentar gerar
// mídia ou chamar o endpoint de publicação.
async function tokenInstagramValido() {
  try {
    const resp = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}?fields=id&access_token=${IG_TOKEN}`);
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

// Consulta os últimos posts publicados no Instagram — é a fonte da verdade
// DEFINITIVA contra duplicatas: mesmo que o registro local se perca (falha de
// push, conflito de git, execução paralela), o que já está no perfil nunca é
// postado de novo. A primeira linha da legenda é sempre a manchete.
async function buscarCaptionsRecentes() {
  try {
    const resp = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media?fields=caption,timestamp&limit=25&access_token=${IG_TOKEN}`);
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

// O token NUNCA vai na linha de comando (vazaria em mensagem de erro e na
// lista de processos). O GIT_ASKPASS entrega a senha via env quando o git
// pede credencial — vale pro clone e pros pushes seguintes no PAGES_DIR.
function criarAskpass() {
  const askpass = path.join(require('os').tmpdir(), 'bdi-askpass.sh');
  fs.writeFileSync(askpass, '#!/bin/sh\necho "$BDI_GIT_TOKEN"\n', { mode: 0o755 });
  return askpass;
}

function git(cmd, cwd) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (process.env.PAGES_TOKEN) {
    env.GIT_ASKPASS = criarAskpass();
    env.BDI_GIT_TOKEN = process.env.PAGES_TOKEN;
  }
  execSync(cmd, { cwd, stdio: 'inherit', env });
}

function commitSeguro(mensagem, cwd) {
  execFileSync('git', ['commit', '-m', mensagem], { cwd, stdio: 'inherit' });
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

  if (!await tokenInstagramValido()) return;

  if (!estaNoHorarioPico()) {
    const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    console.log(`Fora do horário de postagem (${hora} BRT). Postagens acontecem entre 06h e 22h.`);
    registrarVerificacao('fora_horario', `Verificação fora do horário de pico (${hora} BRT). Postagens ocorrem entre 06h e 22h.`);
    return;
  }

  // Cada ciclo editorial ocorre a cada 1h30. Mantemos esse intervalo como
  // proteção adicional caso o workflow seja disparado manualmente.
  const INTERVALO_MIN_MS = 90 * 60 * 1000;
  const ultimoPost = relatorio.find(p => p.origem !== 'manual');
  if (ultimoPost) {
    const tempoDesdeUltimo = Date.now() - new Date(ultimoPost.data).getTime();
    if (tempoDesdeUltimo < INTERVALO_MIN_MS) {
      const minRestantes = Math.ceil((INTERVALO_MIN_MS - tempoDesdeUltimo) / 60000);
      console.log(`Último post há ${Math.floor(tempoDesdeUltimo / 60000)} min. Próximo em ${minRestantes} min (intervalo de 3h).`);
      registrarVerificacao('aguardando_intervalo', `Aguardando intervalo de 1h30 entre posts. Faltam ${minRestantes} min.`);
      return;
    }
  }

  // Feed recebe somente notícias de alto impacto, no máximo uma a cada 1h30.
  // O teto evita uma enxurrada caso diversas fontes publiquem a mesma pauta.
  const MAX_POSTS_DIA = 10;
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

  const permissao = podePublicarFeed();
  if (!permissao.permitido) {
    console.log(`Feed suprimido: ${permissao.motivo}.`);
    registrarVerificacao('feed_suprimido', `Feed não publicado: ${permissao.motivo}.`);
    return;
  }

  // Títulos já postados nos últimos 3 dias (para evitar duplicatas por assunto,
  // não só por link). Limitado a 3 dias porque manchetes recorrentes ("Dólar
  // sobe...", "Ibovespa fecha em alta...") são notícias legítimas novas em dias
  // diferentes — comparar com o histórico inteiro bloqueava conteúdo válido.
  const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;
  const titulosPostados = relatorio
    .filter(r => r.data && (Date.now() - new Date(r.data).getTime()) <= TRES_DIAS_MS)
    .map(r => (r.titulo || '').toLowerCase());

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

  // Publica apenas notícia nova com impacto editorial forte, já ordenada por peso.
  const UMA_HORA_MS = 60 * 60 * 1000;
  const agora = Date.now();
  const candidatas = noticias.filter(n =>
    n.link &&
    !postadas.has(n.link) &&
    !tituloJaPostado(n.titulo) &&
    n.publicadoEm > 0 &&
    (n.peso || 0) >= PESO_MINIMO_PUBLICACAO &&
    (agora - n.publicadoEm) <= UMA_HORA_MS
  );

  // Camada final de dedup: consulta o PRÓPRIO Instagram e descarta qualquer
  // candidata cujo título já apareça na legenda de um post das últimas 48h.
  const captionsRecentes = await buscarCaptionsRecentes();
  console.log(`Dedup Instagram: ${captionsRecentes.length} legendas recentes consultadas.`);

  // Se não houver notícia nova na última 1h, não posta (evita conteúdo desatualizado)
  const nova = candidatas.find(c => {
    const jaNoPerfil = captionsRecentes.some(cap => titulosSimilares(c.titulo, cap));
    if (jaNoPerfil) console.log(`Pulando (já está no perfil): ${c.titulo.slice(0, 70)}`);
    return !jaNoPerfil;
  }) || null;

  if (!nova) {
    console.log('Nenhuma noticia nova na última 1h. Nada a postar.');
    registrarVerificacao('sem_noticia', 'Nenhuma notícia nova na última hora. Nada foi postado.');
    return;
  }

  const qualidadeConteudo = validarNoticiaParaPublicacao(nova);
  if (!qualidadeConteudo.aprovada) {
    console.log(`Pulando notícia: ${qualidadeConteudo.motivo}.`);
    registrarVerificacao('pauta_reprovada', `Notícia não publicada: ${qualidadeConteudo.motivo}.`, { titulo: nova.titulo });
    return;
  }

  console.log(`Notícia selecionada (peso ${nova.peso}): ${nova.titulo}`);
  registrarVerificacao('noticia_encontrada', `Notícia nova encontrada (peso ${nova.peso || '?'}): "${nova.titulo}". Realizando postagem...`);

  const sentimento = detectarSentimento(nova.titulo, nova.descricao || '');
  const cfg = {
    categoria: (nova.categorias && nova.categorias[0]) || 'MERCADO',
    manchete: nova.titulo,
    resumo: (nova.descricao || '').replace(/\[…\]|\[&#8230;\]/g, '').trim(),
    fonte: nova.fonte,
    link: nova.link,
    imagem: nova.imagem || null,
    sentimento,
    pergunta: PERGUNTAS[sentimento.tipo] || PERGUNTAS.padrao,
    acentoGradiente: sentimento.gradiente,
    acentoCor: sentimento.cor,
    acentoTexto: sentimento.texto,
  };
  const qualidade = validarPautaAutomatica({
    manchete: cfg.manchete,
    resumo: cfg.resumo,
    tema: sentimento.tipo,
  });
  if (!qualidade.aprovada) {
    registrarVerificacao('pauta_reprovada', `Pauta não publicada: ${qualidade.motivo}.`, { titulo: cfg.manchete, tema: sentimento.tipo });
    return;
  }
  const capa = criarCapaRetencao(cfg.manchete, cfg.categoria);
  cfg.mancheteVisual = capa.gancho;
  cfg.acaoCapa = 'Arraste para entender →';
  cfg.apoioCapa = capa.apoio;
  if (!cfg.imagem) {
    cfg.imagem = await buscarImagemArtigo(cfg.link);
  }
  if (cfg.imagem) {
    cfg.imagem = await baixarImagemBase64(cfg.imagem);
  }

  console.log('Nova noticia:', cfg.manchete);

  // Clona o repo do GitHub Pages para publicar as imagens dos cards
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN (PAT com acesso de escrita ao repo do GitHub Pages).');
  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);

  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ts = Date.now();
  const legenda = montarLegenda(cfg);
  let postId = null;
  let storyId = null;
  let reelId = null;
  let videoUrl = null;
  let imageUrl = null;
  let storyImageUrl = null;

  const formato = selecionarFormatoFeed(nova.peso);
  console.log(`Formato escolhido: ${formato} (pauta aprovada, peso ${nova.peso})`);

  if (formato === 'reel') {
    // === REEL NARRADO ===
    console.log(`Gerando Reel narrado + TikTok...`);

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
    commitSeguro(`Reel narrado: ${cfg.manchete.slice(0, 50)}`, PAGES_DIR);
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

  } else if (formato === 'carrossel') {
    // === CARROSSEL NARRATIVO (10 slides) ===
    // Capa > fatos > contexto > impacto > cautela > resumo > CTA.
    // Cada imagem responde uma pergunta e abre a seguinte, sem inventar dados.
    const slidesCfg = montarNarrativaImpacto({
      manchete: cfg.manchete,
      resumo: cfg.resumo,
      categoria: cfg.categoria,
      sentimento: cfg.sentimento?.tipo,
      apoioCapa: cfg.apoioCapa,
    });
    const qualidade = avaliarCarrossel({
      manchete: cfg.manchete,
      resumo: cfg.resumo,
      fonte: cfg.fonte,
      peso: nova.peso,
      slides: slidesCfg,
      impacto: cfg.apoioCapa,
    });
    if (!qualidade.aprovada) {
      registrarVerificacao('carrossel_reprovado_qualidade', `Carrossel bloqueado (nota ${qualidade.nota}): ${qualidade.bloqueios.join('; ')}`, { nota: qualidade.nota, bloqueios: qualidade.bloqueios });
      return;
    }

    const totalSlides = 1 + slidesCfg.length + 1; // capa + internos + final
    const nomes = [];

    // Capa: card de notícia com a foto
    const nomeCapa = `noticia-${ts}-slide1.png`;
    await gerarCard({ ...cfg, manchete: cfg.mancheteVisual, pergunta: cfg.acaoCapa }, path.join(cardsDir, nomeCapa));
    nomes.push(nomeCapa);

    for (let i = 0; i < slidesCfg.length; i++) {
      const nome = `noticia-${ts}-slide${i + 2}.png`;
      await gerarSlide({ ...slidesCfg[i], contador: `${i + 2}/${totalSlides}` }, path.join(cardsDir, nome));
      nomes.push(nome);
    }

    const nomeFinal = `noticia-${ts}-slide${totalSlides}.png`;
    await gerarSlide({ final: true }, path.join(cardsDir, nomeFinal));
    nomes.push(nomeFinal);

    git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
    git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
    git(`git add ${nomes.map(n => `bdi-cards/${n}`).join(' ')}`, PAGES_DIR);
    commitSeguro(`Carrossel: ${cfg.manchete.slice(0, 60)}`, PAGES_DIR);
    git('git push', PAGES_DIR);

    await new Promise(r => setTimeout(r, 15000));

    // Cria containers de cada slide
    const criarItem = async (imgUrl) => {
      const r = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imgUrl)}&is_carousel_item=true&access_token=${IG_TOKEN}`, { method: 'POST' });
      const d = await r.json();
      if (!d.id) throw new Error('Erro ao criar item do carrossel: ' + JSON.stringify(d));
      return d.id;
    };
    const itens = [];
    for (const nome of nomes) {
      itens.push(await criarItem(`${PAGES_RAW_BASE}/${nome}`));
    }

    // Cria container do carrossel
    const carouselResp = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media?media_type=CAROUSEL&children=${itens.join(',')}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`, { method: 'POST' });
    const carouselData = await carouselResp.json();
    if (!carouselData.id) throw new Error('Erro ao criar carrossel: ' + JSON.stringify(carouselData));

    await aguardarContainerPronto(carouselData.id);
    const pubResp = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${carouselData.id}&access_token=${IG_TOKEN}`, { method: 'POST' });
    const pubData = await pubResp.json();
    if (!pubData.id) throw new Error('Erro ao publicar carrossel: ' + JSON.stringify(pubData));

    postId = pubData.id;
    imageUrl = `${PAGES_RAW_BASE}/${nomes[0]}`;
    console.log(`Carrossel de ${totalSlides} slides publicado no Instagram! ID:`, postId);

  } else {
    // === CARD ESTÁTICO ===
    const nomeFeed = `noticia-${ts}-feed.png`;
    const nomeStory = `noticia-${ts}-story.png`;
    await gerarCard(cfg, path.join(cardsDir, nomeFeed));
    await gerarCard({ ...cfg, formato: 'story' }, path.join(cardsDir, nomeStory));

    git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
    git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
    git(`git add bdi-cards/${nomeFeed} bdi-cards/${nomeStory}`, PAGES_DIR);
    commitSeguro(`Card automatico: ${cfg.manchete.slice(0, 60)}`, PAGES_DIR);
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
    tipo: formato,
    peso: nova.peso || 0,
    pilares: nova.pilares || [],
    horarioBRT: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()),
    cta: cfg.cta || null,
    decisaoFormato: `peso ${nova.peso || 0}: ${formato}`,
  });
  salvarJson(RELATORIO_FILE, relatorio.slice(0, 200));

  registrarVerificacao('postado', `Postagem realizada com sucesso (${formato}): "${cfg.manchete}".`, { postId, storyId, reelId, tipo: formato });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro na execucao automatica:', e.message);
  registrarVerificacao('erro', `Erro na execução automática: ${e.message}`);
  process.exit(1);
});
