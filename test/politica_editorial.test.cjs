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

test('aprova eleição somente quando há impacto econômico objetivo', () => {
  const resultado = classificarEditorial({
    titulo: 'Eleições: proposta fiscal coloca juros e dólar no radar do mercado',
    descricao: 'A medida prevê mudanças no orçamento e pode afetar a percepção de investidores.',
    categorias: ['Política'], peso: 92,
  });
  assert.equal(resultado.aprovada, true);
  assert.ok(resultado.pilares.includes('brasil_eleicoes'));
});

test('bloqueia política eleitoral sem impacto econômico ou pesquisa sem registro', () => {
  const semImpacto = classificarEditorial({
    titulo: 'Candidato faz evento de campanha eleitoral nesta tarde', descricao: 'A agenda reúne apoiadores.', categorias: ['Política'], peso: 95,
  });
  const pesquisaSemRegistro = classificarEditorial({
    titulo: 'Pesquisa eleitoral mostra mudança na intenção de voto', descricao: 'Levantamento foi divulgado nesta manhã.', categorias: ['Política'], peso: 95,
  });
  assert.match(semImpacto.motivo, /impacto econômico/);
  assert.match(pesquisaSemRegistro.motivo, /registro/);
});
