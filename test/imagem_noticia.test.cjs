const test = require('node:test');
const assert = require('node:assert/strict');
const { extrairImagemOg } = require('../imagem_noticia.cjs');

test('extrai imagem principal do Open Graph em qualquer ordem de atributos', () => {
  assert.equal(extrairImagemOg('<meta property="og:image" content="https://site.com/a.jpg">'), 'https://site.com/a.jpg');
  assert.equal(extrairImagemOg('<meta content="https://site.com/b.jpg?x=1&amp;y=2" property="og:image">'), 'https://site.com/b.jpg?x=1&y=2');
  assert.equal(extrairImagemOg('<meta property="og:title" content="Sem imagem">'), null);
});
