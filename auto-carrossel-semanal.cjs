// Publica todo domingo um carrossel com as 7 noticias mais importantes da
// semana (resumo "o que voce pode ter perdido"). Usa o relatorio.json das
// postagens da semana, ranqueado por peso de impacto.
// Vars necessarias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { gerarCard } = require('./gerar_card_noticia.cjs');
const { calcularPesoImpacto, titulosSimilares } = require('./coletor_noticias.cjs');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

const RELATORIO_FILE = path.join(__dirname, 'relatorio.json');
const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const QTD_SLIDES = 7;

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

async function aguardarContainerPronto(id, tentativas = 30) {
  for (let i = 0; i < tentativas; i++) {
    const resp = await fetch(`${IG_API_BASE}/${id}?fields=status_code&access_token=${IG_TOKEN}`);
    const data = await resp.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Container com erro: ' + JSON.stringify(data));
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Timeout aguardando container: ' + id);
}

function selecionarTopSemana(relatorio) {
  const agora = Date.now();
  const daSemana = relatorio.filter(r => (agora - new Date(r.data).getTime()) < SETE_DIAS_MS && r.titulo);

  // Usa o peso salvo; se a entrada for antiga e nao tiver peso, recalcula pelo titulo
  const comPeso = daSemana.map(r => ({ ...r, pesoEfetivo: r.peso || calcularPesoImpacto(r.titulo, '', [r.categoria || '']) }));
  comPeso.sort((a, b) => b.pesoEfetivo - a.pesoEfetivo);

  const selecionadas = [];
  for (const item of comPeso) {
    if (selecionadas.some(s => titulosSimilares(s.titulo, item.titulo))) continue;
    selecionadas.push(item);
    if (selecionadas.length >= QTD_SLIDES) break;
  }
  return selecionadas;
}

async function criarItemCarrossel(imgUrl) {
  const r = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imgUrl)}&is_carousel_item=true&access_token=${IG_TOKEN}`, { method: 'POST' });
  const d = await r.json();
  if (!d.id) throw new Error('Erro ao criar item do carrossel: ' + JSON.stringify(d));
  return d.id;
}

function montarLegenda(selecionadas) {
  const itens = selecionadas.map((n, i) => `${i + 1}. ${n.titulo}`).join('\n\n');
  return `📅 Resumo da semana: o que você pode ter perdido\n\n${itens}\n\n📊 Fique por dentro todos os dias: https://bomdiainvestidor.com.br/\n\n#mercadofinanceiro #resumosemanal #investimentos #bolsadevalores #economia`;
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN.');

  const relatorio = carregarJson(RELATORIO_FILE, []);
  const selecionadas = selecionarTopSemana(relatorio);

  if (selecionadas.length < 3) {
    console.log(`Só ${selecionadas.length} notícia(s) na semana — resumo semanal não gerado (mínimo 3).`);
    registrarVerificacao('sem_resumo_semanal', `Apenas ${selecionadas.length} notícia(s) postada(s) na semana. Resumo semanal não foi gerado.`);
    return;
  }

  console.log(`Gerando resumo semanal com ${selecionadas.length} notícia(s).`);

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ts = Date.now();
  const nomesSlides = [];
  for (let i = 0; i < selecionadas.length; i++) {
    const n = selecionadas[i];
    const nomeSlide = `resumo-semanal-${ts}-slide${i + 1}.png`;
    await gerarCard({
      categoria: 'RESUMO DA SEMANA',
      manchete: n.titulo,
      fonte: n.fonte,
      pergunta: `Notícia ${i + 1} de ${selecionadas.length} dessa semana`,
      imagem: null,
      acentoGradiente: 'linear-gradient(135deg, #c9920a, #f0c060)',
      acentoTexto: '#1a1200',
      acentoCor: '#c9920a',
    }, path.join(cardsDir, nomeSlide));
    nomesSlides.push(nomeSlide);
  }

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add ${nomesSlides.map(n => `bdi-cards/${n}`).join(' ')}`, PAGES_DIR);
  git(`git commit -m "Resumo semanal (${selecionadas.length} noticias)"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  await new Promise(r => setTimeout(r, 15000));

  const itemIds = [];
  for (const nome of nomesSlides) {
    const url = `${PAGES_RAW_BASE}/${nome}`;
    itemIds.push(await criarItemCarrossel(url));
  }

  const legenda = montarLegenda(selecionadas);
  const carouselResp = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media?media_type=CAROUSEL&children=${itemIds.join(',')}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`, { method: 'POST' });
  const carouselData = await carouselResp.json();
  if (!carouselData.id) throw new Error('Erro ao criar carrossel semanal: ' + JSON.stringify(carouselData));

  await aguardarContainerPronto(carouselData.id);
  const pubResp = await fetch(`${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${carouselData.id}&access_token=${IG_TOKEN}`, { method: 'POST' });
  const pubData = await pubResp.json();
  if (!pubData.id) throw new Error('Erro ao publicar carrossel semanal: ' + JSON.stringify(pubData));

  console.log('Resumo semanal publicado! ID:', pubData.id);
  registrarVerificacao('resumo_semanal', `Resumo semanal publicado com ${selecionadas.length} notícias.`, {
    postId: pubData.id,
    noticias: selecionadas.map(n => n.titulo),
  });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao publicar resumo semanal:', e.message);
  registrarVerificacao('erro_resumo_semanal', `Erro ao publicar resumo semanal: ${e.message}`);
  process.exit(1);
});
