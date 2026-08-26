const test = require('node:test');
const assert = require('node:assert/strict');
const { extrairImagemOg, extrairImagensArtigo, extrairTextoArtigo, dividirEmBlocosEditoriais } = require('../imagem_noticia.cjs');

test('extrai imagem principal do Open Graph em qualquer ordem de atributos', () => {
  assert.equal(extrairImagemOg('<meta property="og:image" content="https://site.com/a.jpg">'), 'https://site.com/a.jpg');
  assert.equal(extrairImagemOg('<meta content="https://site.com/b.jpg?x=1&amp;y=2" property="og:image">'), 'https://site.com/b.jpg?x=1&y=2');
  assert.equal(extrairImagemOg('<meta property="og:title" content="Sem imagem">'), null);
});

test('usa Twitter, JSON-LD, srcset e converte caminhos relativos em alternativas', () => {
  const html = `
    <meta name="twitter:image" content="/foto-principal.jpg?x=1&amp;y=2">
    <script type="application/ld+json">{"image":{"url":"https://cdn.site.com/editorial.webp"}}</script>
    <img src="placeholder.gif" data-src="/lazy.jpg" srcset="/small.jpg 320w, /large.jpg 1280w">
  `;
  assert.deepEqual(extrairImagensArtigo(html, 'https://site.com/materia'), [
    'https://site.com/foto-principal.jpg?x=1&y=2',
    'https://cdn.site.com/editorial.webp',
    'https://site.com/lazy.jpg',
    'https://site.com/large.jpg',
    'https://site.com/small.jpg',
  ]);
});

test('extrai parágrafos editoriais e ignora chamadas promocionais', () => {
  const html = `<article><p class="content-text__container">O IPCA-15 caiu 0,40% em agosto, segundo o IBGE.</p><p class="content-text__container">Com o resultado, o índice acumula alta de 4,24% em doze meses.</p><p class="content-text__container">Leia também</p></article>`;
  assert.equal(extrairTextoArtigo(html), 'O IPCA-15 caiu 0,40% em agosto, segundo o IBGE.\n\nCom o resultado, o índice acumula alta de 4,24% em doze meses.');
});

test('divide a matéria em blocos sem cortar números ou frases', () => {
  const blocos = dividirEmBlocosEditoriais('O IPCA-15 caiu 0,40% em agosto. Em doze meses, o índice acumula alta de 4,24%. Habitação e transportes puxaram a queda.', 90, 3);
  assert.equal(blocos.join(' '), 'O IPCA-15 caiu 0,40% em agosto. Em doze meses, o índice acumula alta de 4,24%. Habitação e transportes puxaram a queda.');
  assert.ok(blocos.every(bloco => /[.!?]$/.test(bloco)));
});
