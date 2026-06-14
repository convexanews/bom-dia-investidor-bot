// Gera um card de noticia financeira (feed 1080x1350 ou story 1080x1920) para o "Bom Dia Investidor".
// Uso: node gerar_card_noticia.cjs '<json_da_config>' <arquivo_saida.png>
// cfg.formato === 'story' gera a versao 1080x1920.
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function gerarCard(cfg, saida) {
  const isStory = cfg.formato === 'story';
  const arquivoTemplate = isStory ? 'card-noticia-story.html' : 'card-noticia.html';
  const altura = isStory ? 1920 : 1350;

  let template = fs.readFileSync(path.join(__dirname, arquivoTemplate), 'utf8');

  template = template
    .replace('{{CATEGORIA}}', escapeHtml((cfg.categoria || 'MERCADO').toUpperCase()))
    .replace('{{MANCHETE}}', escapeHtml(cfg.manchete || ''))
    .replace('{{IMAGEM_URL}}', cfg.imagem || '');

  const tmpHtml = path.join(__dirname, `_tmp_card_noticia_${isStory ? 'story' : 'feed'}.html`);
  fs.writeFileSync(tmpHtml, template, 'utf8');

  try { if (!fs.existsSync(path.dirname(saida))) fs.mkdirSync(path.dirname(saida), { recursive: true }); } catch {}

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: altura });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: altura } });
  await browser.close();
  fs.unlinkSync(tmpHtml);

  return saida;
}

if (require.main === module) {
  (async () => {
    const cfg = JSON.parse(process.argv[2]);
    const saida = process.argv[3] || path.join(__dirname, 'card-noticia-saida.png');
    await gerarCard(cfg, saida);
    console.log('Card gerado:', saida);
  })();
}

module.exports = { gerarCard };
