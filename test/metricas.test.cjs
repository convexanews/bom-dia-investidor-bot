const test = require('node:test');
const assert = require('node:assert/strict');
const { resumoPorFormato } = require('../coletar_metricas.cjs');

test('resume indicadores por formato ignorando métricas indisponíveis', () => {
  const resumo = resumoPorFormato([
    { tipo: 'reel', insights: { reach: 100, saved: 10, shares: 4, plays: 120 } },
    { tipo: 'reel', insights: { reach: 200, saved: 20, shares: 6, plays: 240 } },
    { tipo: 'carrossel', insights: { reach: 80 } },
  ]);
  assert.deepEqual(resumo.reel, { posts: 2, alcanceMedio: 150, salvamentosMedios: 15, compartilhamentosMedios: 5, reproducoesMedias: 180 });
  assert.equal(resumo.carrossel.alcanceMedio, 80);
  assert.equal(resumo.carrossel.salvamentosMedios, null);
});
