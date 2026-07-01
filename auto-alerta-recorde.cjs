// Roda junto do cron de 30min (auto-post.yml). Verifica se Ibovespa, Dólar
// ou Bitcoin bateram um novo recorde (marco redondo nunca atingido antes,
// pra cima ou pra baixo) e publica um card de alerta automaticamente.
// Vars necessarias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const ESTADO_FILE = path.join(__dirname, 'alerta-recorde-estado.json');
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

// "step" = tamanho do marco redondo que consideramos noticia (ex: a cada R$0,25 no dolar)
const ATIVOS = [
  { simbolo: '^BVSP', nome: 'Ibovespa', chave: 'ibov', icone: '📈', step: 5000, formato: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' pontos' },
  { simbolo: 'BRL=X', nome: 'Dólar', chave: 'dolar', icone: '💵', step: 0.25, formato: v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  { simbolo: 'BTC-USD', nome: 'Bitcoin', chave: 'btc', icone: '₿', step: 5000, formato: v => 'US$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) },
];

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

async function buscarValorAtual(simbolo) {
  const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=1d&interval=1d`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await resp.json();
  return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
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

async function publicarFeed(imageUrl, legenda) {
  const createUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`;
  const createResp = await fetch(createUrl, { method: 'POST' });
  const createData = await createResp.json();
  if (!createData.id) throw new Error('Erro ao criar container: ' + JSON.stringify(createData));
  await aguardarContainerPronto(createData.id);
  const publishUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${createData.id}&access_token=${IG_TOKEN}`;
  const publishResp = await fetch(publishUrl, { method: 'POST' });
  const publishData = await publishResp.json();
  if (!publishData.id) throw new Error('Erro ao publicar: ' + JSON.stringify(publishData));
  return publishData.id;
}

async function gerarImagem(cfg, saida) {
  let html = fs.readFileSync(path.join(__dirname, 'card-alerta-recorde.html'), 'utf8');
  const subs = {
    '{{TIPO_ALERTA}}': cfg.tipoAlerta,
    '{{ICONE}}': cfg.icone,
    '{{ATIVO_NOME}}': cfg.ativoNome,
    '{{VALOR}}': cfg.valor,
    '{{FRASE}}': cfg.frase,
  };
  for (const [k, v] of Object.entries(subs)) html = html.split(k).join(v);

  const tmpHtml = path.join(__dirname, `_tmp_alerta_${cfg.chave}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await browser.close();
  fs.unlinkSync(tmpHtml);
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN.');

  const estado = carregarJson(ESTADO_FILE, {});
  let alertaParaPostar = null;

  for (const ativo of ATIVOS) {
    const valor = await buscarValorAtual(ativo.simbolo);
    if (valor == null) continue;

    const marco = Math.floor(valor / ativo.step) * ativo.step;
    const st = estado[ativo.chave] || { maiorMarco: marco, menorMarco: marco };

    if (marco > st.maiorMarco) {
      if (!alertaParaPostar) {
        alertaParaPostar = {
          chave: ativo.chave, icone: ativo.icone, ativoNome: ativo.nome,
          valor: ativo.formato(valor), tipoAlerta: 'NOVA MÁXIMA',
          frase: `Pela primeira vez, <strong>${ativo.nome}</strong> passa de ${ativo.formato(marco)}!`,
        };
      }
      st.maiorMarco = marco;
    } else if (marco < st.menorMarco) {
      if (!alertaParaPostar) {
        alertaParaPostar = {
          chave: ativo.chave, icone: ativo.icone, ativoNome: ativo.nome,
          valor: ativo.formato(valor), tipoAlerta: 'NOVA MÍNIMA',
          frase: `<strong>${ativo.nome}</strong> cai abaixo de ${ativo.formato(marco + ativo.step)} — menor nível recente.`,
        };
      }
      st.menorMarco = marco;
    }

    estado[ativo.chave] = st;
  }

  salvarJson(ESTADO_FILE, estado);

  if (!alertaParaPostar) {
    console.log('Nenhum novo recorde de marco redondo nesta verificação.');
    return;
  }

  console.log(`Recorde detectado: ${alertaParaPostar.ativoNome} — ${alertaParaPostar.tipoAlerta}`);

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ts = Date.now();
  const nomeImg = `recorde-${alertaParaPostar.chave}-${ts}.png`;
  await gerarImagem(alertaParaPostar, path.join(cardsDir, nomeImg));

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nomeImg}`, PAGES_DIR);
  git(`git commit -m "Alerta de recorde: ${alertaParaPostar.ativoNome}"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  const url = `${PAGES_RAW_BASE}/${nomeImg}`;
  await new Promise(r => setTimeout(r, 15000));

  const legenda = `🚨 ${alertaParaPostar.tipoAlerta}: ${alertaParaPostar.ativoNome}\n\n${alertaParaPostar.frase.replace(/<\/?strong>/g, '')}\n\n📊 Fique por dentro: https://bomdiainvestidor.com.br/\n\n#mercadofinanceiro #investimentos #${alertaParaPostar.chave}`;
  const postId = await publicarFeed(url, legenda);
  console.log('Alerta de recorde publicado! ID:', postId);

  registrarVerificacao('alerta_recorde', `Alerta de recorde publicado: ${alertaParaPostar.ativoNome} (${alertaParaPostar.tipoAlerta}).`, { postId });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao verificar/publicar alerta de recorde:', e.message);
  registrarVerificacao('erro_alerta_recorde', `Erro ao verificar alerta de recorde: ${e.message}`);
  process.exit(1);
});
