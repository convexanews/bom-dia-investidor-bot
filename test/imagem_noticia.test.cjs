const test = require('node:test');
const assert = require('node:assert/strict');
const { extrairImagemOg, extrairImagensArtigo } = require('../imagem_noticia.cjs');

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
