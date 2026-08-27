const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanEditorial, buildStudioProject, validateStudioProject } = require('../studio-content-engine.cjs');

const noticia = {
  titulo: 'Ibovespa avança após divulgação de dados econômicos importantes nesta quarta-feira',
  descricao: 'O principal índice da bolsa brasileira avançou após a divulgação de novos indicadores. Investidores também acompanharam juros e mercados internacionais.',
  fonte: 'InfoMoney', link: 'https://example.com/noticia', pilares: ['bolsa'], categorias: ['Bolsa'],
};
const article = { blocos: [
  'O Ibovespa avançou durante o pregão depois da divulgação de indicadores econômicos acompanhados pelo mercado.',
  'As ações de empresas de grande peso ajudaram o índice, enquanto investidores revisaram as expectativas para os juros.',
  'O movimento pode influenciar a percepção de risco e o desempenho dos principais setores da bolsa brasileira.',
  'Os próximos dados econômicos e o fluxo estrangeiro devem permanecer no radar dos investidores.',
] };
const images = ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'];

test('motor compartilhado remove link e atributos vazados da matéria', () => {
  const clean = cleanEditorial('Notas data-large-file="https://site/imagem.jpg" Veja https://site.test agora.');
  assert.doesNotMatch(clean, /https?:|data-large-file/);
});

test('motor compartilhado cria o mesmo projeto narrativo para carrossel e Reel', () => {
  const carousel = buildStudioProject(noticia, { format: 'carousel', article, images });
  const reel = buildStudioProject(noticia, { format: 'reel', article, images });
  assert.equal(carousel.slides.length, 6);
  assert.equal(reel.slides.length, 5);
  assert.match(carousel.slides[1].headline, /fato por trás/i);
  assert.match(reel.slides[2].headline, /impacto para o investidor/i);
  assert.ok(carousel.slides.every(slide => slide.image && /Fonte: InfoMoney/.test(slide.source)));
});

test('portão compartilhado bloqueia imagem ausente e aprova projeto completo', () => {
  const complete = buildStudioProject(noticia, { format: 'carousel', article, images });
  assert.equal(validateStudioProject(complete).approved, true);
  complete.slides[2].image = '';
  const invalid = validateStudioProject(complete);
  assert.equal(invalid.approved, false);
  assert.match(invalid.blockers.join(' '), /sem imagem editorial/);
});
