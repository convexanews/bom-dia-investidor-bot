const test = require('node:test');
const assert = require('node:assert/strict');
const { avaliarDesempenhoRecente } = require('../qualidade_desempenho.cjs');

test('pausa automação após três posts maduros com alcance confirmado abaixo do piso', () => {
  const antigos = [3, 4, 5].map(dias => ({
    dataPostagem: new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString(),
    insights: { reach: 12 },
  }));
  assert.equal(avaliarDesempenhoRecente(antigos).aprovado, false);
});

test('não pausa sem três métricas maduras de alcance', () => {
  assert.equal(avaliarDesempenhoRecente([{ dataPostagem: new Date().toISOString(), insights: { reach: 1 } }]).aprovado, true);
});
