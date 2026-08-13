// Gera todas as imagens de stories prontos (banco em storys-templates.cjs) para o
// painel de acompanhamento, em painel/storys-imgs/<slug>.png. Postagem é manual:
// o usuário abre o painel, baixa a imagem e posta direto no Instagram Stories.
const fs = require('fs');
const path = require('path');
const TEMPLATES = require('./storys-templates.cjs');
const { renderizarTemplate } = require('./renderizar_template.cjs');

const OUT_DIR = path.join(__dirname, 'painel', 'storys-imgs');

async function gerarImagem(enquete, data, saida) {
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

  return renderizarTemplate({ html, saida, largura: 1080, altura: 1920, nome: `painel_${enquete.slug}` });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const data = ''; // banco evergreen — sem data fixa, vale o ano todo
  for (const tpl of TEMPLATES) {
    const saida = path.join(OUT_DIR, `${tpl.slug}.png`);
    console.log('Gerando:', tpl.slug);
    await gerarImagem(tpl, data, saida);
  }

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
