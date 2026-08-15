// Renderização segura de templates HTML para as artes publicadas.
// Falhas de navegação ou de layout interrompem o workflow antes da publicação.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function validarPng(buffer, saida) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const assinatura = '89504e470d0a1a0a';
  if (buf.length < 10_000 || buf.subarray(0, 8).toString('hex') !== assinatura) {
    throw new Error(`Render inválido: PNG vazio ou corrompido (${saida}). Tamanho: ${buf.length}`);
  }
}

async function renderizarTemplate({ html, saida, largura, altura, nome = 'card' }) {
  if (!html || !String(html).trim()) throw new Error(`Template vazio: ${nome}.`);
  if (String(html).includes('{{') || String(html).includes('}}')) {
    throw new Error(`Render inválido: ${nome} ainda contém placeholders não preenchidos.`);
  }
  if (!Number.isInteger(largura) || !Number.isInteger(altura)) throw new Error(`Dimensões inválidas para ${nome}.`);

  const temporario = path.join(__dirname, `_tmp_${nome}_${process.pid}_${Date.now()}.html`);
  fs.writeFileSync(temporario, html, 'utf8');
  fs.mkdirSync(path.dirname(saida), { recursive: true });

  let browser;
  try {
    // Carregamento tardio mantém as regras puras testáveis sem dependências de navegador.
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-gpu', '--disable-software-rasterizer',
      '--font-render-hinting=none',
    ] });
    const page = await browser.newPage();
    const erros = [];
    page.on('pageerror', erro => erros.push(erro.message));
    await page.setViewport({ width: largura, height: altura, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(temporario).href, { waitUntil: 'networkidle0', timeout: 30_000 });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    // Aguarda breve para garantir repaint completo
    await new Promise(r => setTimeout(r, 500));

    const layout = await page.evaluate(({ largura, altura }) => ({
      texto: document.body?.innerText?.trim() || '',
      largura: document.documentElement.scrollWidth,
      altura: document.documentElement.scrollHeight,
      pendencias: [...document.images].filter(img => img.src && !img.complete).length,
    }), { largura, altura });
    if (!layout.texto) throw new Error(`Render inválido: ${nome} não contém texto visível.`);
    if (layout.largura !== largura || layout.altura !== altura) {
      throw new Error(`Render inválido: ${nome} tem layout ${layout.largura}x${layout.altura}, esperado ${largura}x${altura}.`);
    }
    if (layout.pendencias) throw new Error(`Render incompleto: ${nome} possui imagens ainda carregando.`);
    if (erros.length) throw new Error(`Erro de página em ${nome}: ${erros.join(' | ')}`);

    const pngRaw = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: largura, height: altura } });
    const png = Buffer.isBuffer(pngRaw) ? pngRaw : Buffer.from(pngRaw);
    console.log(`[render] ${nome}: PNG ${png.length} bytes, layout ${layout.largura}x${layout.altura}, texto "${layout.texto.slice(0, 80)}..."`);
    validarPng(png, saida);
    fs.writeFileSync(saida, png);
  } finally {
    if (browser) await browser.close();
    fs.rmSync(temporario, { force: true });
  }
  return saida;
}

module.exports = { renderizarTemplate, validarPng };
