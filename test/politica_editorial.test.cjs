const test = require('node:test');
const assert = require('node:assert/strict');
const { classificarEditorial } = require('../politica_editorial.cjs');

test('bloqueia entretenimento mesmo quando há termos financeiros', () => {
  const resultado = classificarEditorial({
    titulo: 'Marmotas no OnlyFans movimentam milhões', descricao: 'Mercado acompanha', categorias: ['Economia'], peso: 60,
  });
  assert.equal(resultado.aprovada, false);
});

test('aprova notícia de macroeconomia com impacto suficiente', () => {
  const resultado = classificarEditorial({
    titulo: 'IPCA desacelera e mercado ajusta projeções para a Selic', descricao: '', categorias: ['Economia'], peso: 40,
  });
  assert.equal(resultado.aprovada, true);
  assert.ok(resultado.pilares.includes('macro'));
});

test('recusa notícia financeira de impacto baixo', () => {
  const resultado = classificarEditorial({
    titulo: 'FII divulga informe mensal', descricao: '', categorias: ['FIIs'], peso: 10,
  });
  assert.equal(resultado.aprovada, false);
  assert.equal(resultado.motivo, 'impacto editorial insuficiente');
});

test('recusa notícia com pilar financeiro mas impacto abaixo do mínimo de publicação', () => {
  const resultado = classificarEditorial({
    titulo: 'Mercado acompanha atualização de empresa', descricao: '', categorias: ['Empresas'], peso: 29,
  });
  assert.equal(resultado.aprovada, false);
  assert.equal(resultado.motivo, 'impacto editorial insuficiente');
});
