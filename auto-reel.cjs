// Gera e publica, 1x por dia, um Reel-resumo com os cards (story) das noticias
// postadas nas ultimas 24h, 3 segundos cada. Roda via GitHub Actions.
// Variaveis de ambiente necessarias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { gerarReel } = require('./gerar_reel.cjs');
const { podePublicarFeed, registrarPublicacao } = require('./controle_publicacao.cjs');
const { carregarJson, salvarJson, registrarVerificacao, publicarReel, RELATORIO_FILE } = require('./utils.cjs');

const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const SEGUNDOS_POR_IMAGEM = 3;

const { git } = require('./git-seguro.cjs');

function montarLegendaReel(noticias) {
  const titulos = noticias.map(n => `• ${n.titulo}`).join('\n');
  return `📰 Resumo editorial do período:\n\n${titulos}\n\n📌 Salve para consultar os destaques.\n\nConteúdo informativo; não é recomendação de investimento.\n\n#mercadofinanceiro #resumodomercado #investimentos #bomdiainvestidor`;
}

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) {
    throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID nas variaveis de ambiente/secrets.');
  }
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN (PAT com acesso de escrita ao repo do GitHub Pages).');

  const permissao = podePublicarFeed();
  if (!permissao.permitido) {
    registrarVerificacao('reel_suprimido', `Reel-resumo não publicado: ${permissao.motivo}.`);
    return;
  }

  const relatorio = carregarJson(RELATORIO_FILE, []);
  const agora = Date.now();
  const doDia = relatorio
    .filter(p => (agora - new Date(p.data).getTime()) < UM_DIA_MS && p.imagemStory)
    .slice(0, 3)
    .reverse(); // ordem cronologica (mais antiga primeiro)

  if (doDia.length === 0) {
    console.log('Nenhuma noticia postada nas ultimas 24h. Reel nao gerado.');
    registrarVerificacao('sem_reel', 'Nenhuma notícia postada nas últimas 24h. Resumo em vídeo não foi gerado.');
    return;
  }

  console.log(`Gerando reel-resumo com ${doDia.length} noticia(s) das ultimas 24h.`);

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);

  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ts = Date.now();
  const nomeReel = `resumo-${ts}.mp4`;
  await gerarReel(doDia.map(n => n.imagemStory), path.join(cardsDir, nomeReel), SEGUNDOS_POR_IMAGEM);

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add bdi-cards/${nomeReel}`, PAGES_DIR);
  git(`git commit -m "Reel resumo do dia (${doDia.length} noticias)"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  const videoUrl = `${PAGES_RAW_BASE}/${nomeReel}`;

  // Espera a CDN do raw.githubusercontent liberar o arquivo recem enviado
  await new Promise(r => setTimeout(r, 20000));

  const legenda = montarLegendaReel(doDia);
  const reelId = await publicarReel(videoUrl, legenda);
  console.log('Reel publicado! ID:', reelId);
  registrarPublicacao({ titulo: 'Resumo editorial do período', categoria: 'Mercados', fonte: 'Editorial', postId: reelId, reelId, tipo: 'reel_resumo', peso: 80, origem: 'reel_resumo', videoUrl });

  registrarVerificacao('reel_postado', `Resumo em vídeo do dia publicado com ${doDia.length} notícia(s).`, {
    reelId,
    videoUrl,
    noticias: doDia.map(n => n.titulo),
  });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao gerar/publicar reel:', e.message);
  registrarVerificacao('erro_reel', `Erro ao gerar o resumo em vídeo do dia: ${e.message}`);
  process.exit(1);
});
