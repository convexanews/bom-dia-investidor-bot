const test = require('node:test');
const assert = require('node:assert/strict');

test('o módulo de controle mantém intervalo e limite configuráveis', () => {
  // O comportamento com arquivo é exercido nos workflows; este teste protege o contrato público do módulo.
  const controle = require('../controle_publicacao.cjs');
  assert.equal(typeof controle.podePublicarFeed, 'function');
  assert.equal(typeof controle.registrarPublicacao, 'function');
  assert.equal(controle.DUAS_HORAS, 90 * 60 * 1000);
  assert.equal(controle.LIMITE_DIARIO_PADRAO, 4);
});

test('a janela global permite posts entre 6h e 22h em Brasília', () => {
  const { estaNaJanelaDePublicacao } = require('../controle_publicacao.cjs');
  assert.equal(estaNaJanelaDePublicacao(new Date('2026-08-06T09:00:00Z')), true); // 06h BRT
  assert.equal(estaNaJanelaDePublicacao(new Date('2026-08-07T01:00:00Z')), true); // 22h BRT
  assert.equal(estaNaJanelaDePublicacao(new Date('2026-08-06T08:59:00Z')), false); // 05h BRT
  assert.equal(estaNaJanelaDePublicacao(new Date('2026-08-07T02:00:00Z')), false); // 23h BRT
});
