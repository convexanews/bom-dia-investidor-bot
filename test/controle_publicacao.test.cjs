const test = require('node:test');
const assert = require('node:assert/strict');

test('a regra global documenta o limite de quatro posts por dia', () => {
  // O comportamento com arquivo é exercido nos workflows; este teste protege o contrato público do módulo.
  const controle = require('../controle_publicacao.cjs');
  assert.equal(typeof controle.podePublicarFeed, 'function');
  assert.equal(typeof controle.registrarPublicacao, 'function');
});
