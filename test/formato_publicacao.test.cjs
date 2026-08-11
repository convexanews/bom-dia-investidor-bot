const test = require('node:test');
const assert = require('node:assert/strict');
const { selecionarFormatoFeed } = require('../formato_publicacao.cjs');

test('feed alterna carrossel e reel conforme o impacto', () => {
  assert.equal(selecionarFormatoFeed(69), null);
  assert.equal(selecionarFormatoFeed(70), 'carrossel');
  assert.equal(selecionarFormatoFeed(84), 'carrossel');
  assert.equal(selecionarFormatoFeed(85), 'reel');
});
