// Gera todas as imagens de stories prontos (banco em storys-templates.cjs) para o
// painel de acompanhamento, em painel/storys-imgs/<slug>.png. Postagem é manual:
// o usuário abre o painel, baixa a imagem e posta direto no Instagram Stories.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const TEMPLATES = require('./storys-templates.cjs');

const OUT_DIR = path.join(__dirname, 'painel', 'storys-imgs');

function dataHojeBRT() {
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

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
  const data = dataHojeBRT();
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  for (const tpl of TEMPLATES) {
    const saida = path.join(OUT_DIR, `${tpl.slug}.png`);
    console.log('Gerando:', tpl.slug);
    await gerarImagem(browser, tpl, data, saida);
  }

  await browser.close();

  // Manifesto pro painel ler via fetch (lista de slugs + perguntas + categoria)
  fs.writeFileSync(
    path.join(__dirname, 'painel', 'storys-manifest.json'),
    JSON.stringify(TEMPLATES.map(t => ({ slug: t.slug, pergunta: t.pergunta, opcaoA: t.opcaoA, opcaoB: t.opcaoB, icone: t.icone })), null, 2),
    'utf8'
  );

  console.log(`Pronto! ${TEMPLATES.length} imagens geradas em painel/storys-imgs/`);
}

main().catch(e => { console.error(e); process.exit(1); });
