const test = require('node:test');
const assert = require('node:assert/strict');
const { selecionarFormatoFeed } = require('../formato_publicacao.cjs');

test('feed prioriza Reel para toda pauta aprovada', () => {
  assert.equal(selecionarFormatoFeed(69), null);
  assert.equal(selecionarFormatoFeed(70), 'reel');
  assert.equal(selecionarFormatoFeed(84), 'reel');
  assert.equal(selecionarFormatoFeed(85), 'reel');
});
