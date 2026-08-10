const test = require('node:test');
const assert = require('node:assert/strict');
const { avaliarCarrossel, montarNarrativaImpacto } = require('../qualidade_carrossel.cjs');

const pautaImpactante = {
  manchete: 'Banco Central eleva juros em 0,50 ponto e muda o custo do crédito',
  resumo: 'O Comitê elevou a taxa básica em 0,50 ponto percentual após revisar a projeção de inflação. O mercado agora reavalia crédito, renda fixa e o ritmo de atividade econômica.',
  fonte: 'Banco Central do Brasil', peso: 90, categoria: 'Economia', impacto: 'O custo do crédito e as taxas dos títulos entram no radar.',
};

test('aprova carrossel com fato, prova, impacto e sequência narrativa', () => {
  const slides = montarNarrativaImpacto(pautaImpactante);
  const resultado = avaliarCarrossel({ ...pautaImpactante, slides });
  assert.equal(resultado.aprovada, true);
  assert.ok(resultado.nota >= 75);
  assert.equal(slides.length, 4);
});

test('reprova carrossel genérico ou com promessa financeira', () => {
  const resultado = avaliarCarrossel({
    manchete: 'Ganhe dinheiro agora', resumo: 'Lucro garantido e sem risco para você.',
    fonte: '', peso: 45, slides: [],
  });
  assert.equal(resultado.aprovada, false);
  assert.ok(resultado.bloqueios.length >= 3);
});
