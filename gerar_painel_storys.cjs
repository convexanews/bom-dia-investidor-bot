// Gera todas as imagens de stories prontos (banco em storys-templates.cjs) para o
// painel de acompanhamento, em painel/storys-imgs/<slug>.png. Postagem é manual:
// o usuário abre o painel, baixa a imagem e posta direto no Instagram Stories.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const TEMPLATES = require('./storys-templates.cjs');

const OUT_DIR = path.join(__dirname, 'painel', 'storys-imgs');

async function gerarImagem(browser, enquete, data, saida) {
  let html = fs.readFileSync(path.join(__dirname, 'card-story-enquete.html'), 'utf8');
  const subs = {
    '{{ICONE}}': enquete.icone,
    '{{PERGUNTA}}': enquete.pergunta,
    '{{ICONE_A}}': enquete.iconeA,
    '{{OPCAO_A}}': enquete.opcaoA,
    '{{ICONE_B}}': enquete.iconeB,
    '{{OPCAO_B}}': enquete.opcaoB,
    '{{DATA}}': data,
  };
  for (const [k, v] of Object.entries(subs)) html = html.replaceAll(k, v);

  const tmpHtml = path.join(__dirname, `_tmp_painel_${enquete.slug}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await page.close();
  fs.unlinkSync(tmpHtml);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const data = ''; // banco evergreen — sem data fixa, vale o ano todo
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  for (const tpl of TEMPLATES) {
    const saida = path.join(OUT_DIR, `${tpl.slug}.png`);
    console.log('Gerando:', tpl.slug);
    await gerarImagem(browser, tpl, data, saida);
  }

  await browser.close();

  // Injeta a lista direto no index.html (entre os marcadores) — funciona
  // mesmo abrindo o painel via duplo-clique (file://), sem precisar de fetch.
  const manifest = TEMPLATES.map(t => ({ slug: t.slug, pergunta: t.pergunta, opcaoA: t.opcaoA, opcaoB: t.opcaoB, icone: t.icone }));
  const indexPath = path.join(__dirname, 'painel', 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  indexHtml = indexHtml.replace(
    /\/\*STORYS_MANIFEST_START\*\/[\s\S]*?\/\*STORYS_MANIFEST_END\*\//,
    `/*STORYS_MANIFEST_START*/${JSON.stringify(manifest)}/*STORYS_MANIFEST_END*/`
  );
  fs.writeFileSync(indexPath, indexHtml, 'utf8');

  console.log(`Pronto! ${TEMPLATES.length} imagens geradas em painel/storys-imgs/ e index.html atualizado.`);
}

main().catch(e => { console.error(e); process.exit(1); });
