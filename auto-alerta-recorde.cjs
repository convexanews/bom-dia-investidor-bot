// Roda junto do cron de 30min (auto-post.yml). Verifica se Ibovespa, Dólar
// ou Bitcoin bateram um novo recorde (marco redondo nunca atingido antes,
// pra cima ou pra baixo) e publica um card de alerta automaticamente.
// Vars necessarias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { renderizarTemplate } = require('./renderizar_template.cjs');
const { carregarJson, salvarJson, registrarVerificacao, publicarFeed, RELATORIO_FILE } = require('./utils.cjs');

const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
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

function podePublicarAlerta() {
  const relatorio = carregarJson(RELATORIO_FILE, []);
  const agora = Date.now();
  const duasHoras = 2 * 60 * 60 * 1000;
  const inicioDia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  inicioDia.setHours(0, 0, 0, 0);
  const publicadosHoje = relatorio.filter(p => p.origem !== 'manual' && new Date(p.data) >= inicioDia).length;
  const ultimo = relatorio.find(p => p.origem !== 'manual');
  if (publicadosHoje >= 2) return { permitido: false, motivo: 'limite diário de posts atingido' };
  if (ultimo && agora - new Date(ultimo.data).getTime() < duasHoras) return { permitido: false, motivo: 'intervalo mínimo de duas horas' };
  return { permitido: true };
}
const { git } = require('./git-seguro.cjs');

async function buscarValorAtual(simbolo) {
  const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=1d&interval=1d`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await resp.json();
  return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
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

  return renderizarTemplate({ html, saida, largura: 1080, altura: 1350, nome: `alerta_${cfg.chave}` });
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

  const permissao = podePublicarAlerta();
  if (!permissao.permitido) {
    registrarVerificacao('alerta_suprimido', `Alerta de recorde não publicado: ${permissao.motivo}.`, { ativo: alertaParaPostar.ativoNome });
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

  const legenda = `🚨 ${alertaParaPostar.tipoAlerta}: ${alertaParaPostar.ativoNome}\n\n${alertaParaPostar.frase.replace(/<\/?strong>/g, '')}\n\n📌 Acompanhe os próximos dados antes de tomar decisões.\n\nConteúdo informativo; não é recomendação de investimento.\n\n#mercadofinanceiro #investimentos #${alertaParaPostar.chave} #bomdiainvestidor`;
  const postId = await publicarFeed(url, legenda);
  console.log('Alerta de recorde publicado! ID:', postId);

  const relatorio = carregarJson(RELATORIO_FILE, []);
  relatorio.unshift({
    data: new Date().toISOString(), titulo: `${alertaParaPostar.tipoAlerta}: ${alertaParaPostar.ativoNome}`,
    categoria: 'Alerta de mercado', fonte: 'Cotação de mercado', postId, tipo: 'alerta',
    peso: 100, origem: 'alerta_recorde', imagemFeed: url,
  });
  salvarJson(RELATORIO_FILE, relatorio.slice(0, 200));

  registrarVerificacao('alerta_recorde', `Alerta de recorde publicado: ${alertaParaPostar.ativoNome} (${alertaParaPostar.tipoAlerta}).`, { postId });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao verificar/publicar alerta de recorde:', e.message);
  registrarVerificacao('erro_alerta_recorde', `Erro ao verificar alerta de recorde: ${e.message}`);
  process.exit(1);
});
