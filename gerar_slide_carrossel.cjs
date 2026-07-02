// Gera slides internos do carrossel de notícia (1080x1350, visual branco/dourado).
// Slide comum: kicker + texto grande. Slide final: CTA "Siga @bomdia_investidor".
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let logoB64 = null;
function getLogoB64() {
  if (!logoB64) {
    const buf = fs.readFileSync(path.join(__dirname, 'logo-bdi.jpeg'));
    logoB64 = 'data:image/jpeg;base64,' + buf.toString('base64');
  }
  return logoB64;
}

// cfg: { final: true } OU { kicker, texto, contador, rodapeDireita }
async function gerarSlide(cfg, saida) {
  const arquivo = cfg.final ? 'card-carrossel-final.html' : 'card-carrossel-slide.html';
  let template = fs.readFileSync(path.join(__dirname, arquivo), 'utf8');

  template = template
    .replace(/\{\{LOGO_B64\}\}/g, getLogoB64())
    .replace(/\{\{KICKER\}\}/g, escapeHtml(cfg.kicker || ''))
    .replace(/\{\{TEXTO\}\}/g, escapeHtml(cfg.texto || ''))
    .replace(/\{\{CONTADOR\}\}/g, escapeHtml(cfg.contador || ''))
    .replace(/\{\{RODAPE_DIREITA\}\}/g, escapeHtml(cfg.rodapeDireita || 'arraste →'));

  const tmpHtml = path.join(__dirname, `_tmp_slide_carrossel_${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, template, 'utf8');

  try { if (!fs.existsSync(path.dirname(saida))) fs.mkdirSync(path.dirname(saida), { recursive: true }); } catch {}

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await browser.close();
  fs.unlinkSync(tmpHtml);

  return saida;
}

// Divide o resumo em blocos de até ~230 caracteres respeitando frases
function dividirResumo(resumo, maxBlocos = 2) {
  const frases = (resumo || '').match(/[^.!?]+[.!?]+/g) || (resumo ? [resumo] : []);
  const blocos = [];
  let atual = '';
  for (const f of frases) {
    if (atual && (atual + f).length > 230) {
      blocos.push(atual.trim());
      atual = f;
    } else {
      atual += ' ' + f;
    }
  }
  if (atual.trim()) blocos.push(atual.trim());
  return blocos.slice(0, maxBlocos);
}

module.exports = { gerarSlide, dividirResumo };
