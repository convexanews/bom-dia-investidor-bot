const fs = require('fs');
const path = require('path');
const { buildStudioProject, validateStudioProject } = require('./studio-content-engine.cjs');
const { renderStudioProject } = require('./studio-renderer-cloud.cjs');

async function main() {
  const image = `data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname, 'logo-bdi.jpeg')).toString('base64')}`;
  const noticia = {
    titulo: 'Ibovespa avança com bancos e investidores acompanham os próximos dados de inflação',
    descricao: 'O principal índice da bolsa brasileira avançou durante o pregão, apoiado por ações de grande peso.',
    fonte: 'Bom Dia Investidor', link: 'https://example.com', pilares: ['bolsa'], categorias: ['Bolsa'],
  };
  const article = { blocos: [
    `${noticia.descricao} O mercado também acompanha os juros e o cenário internacional.`,
    'As ações de bancos e empresas exportadoras ajudaram o índice enquanto o mercado revisou expectativas.',
    'O movimento pode mudar a percepção de risco e influenciar diferentes setores da bolsa.',
    'Os próximos indicadores e o fluxo estrangeiro permanecem no radar.',
  ] };
  const project = buildStudioProject(noticia, { format: process.argv[2] || 'carousel', article, images: [image] });
  const quality = validateStudioProject(project);
  if (!quality.approved) throw new Error(quality.blockers.join('; '));
  const output = path.join(__dirname, 'output', 'studio-engine-preview');
  const files = await renderStudioProject(project, output, 'preview');
  console.log(files.join('\n'));
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });
