const test = require('node:test');
const assert = require('node:assert/strict');
const { validarNoticiaParaPublicacao } = require('../qualidade_publicacao.cjs');

const noticiaCompleta = {
  titulo: 'Wall Street fecha em tom misto após dado de inflação nos Estados Unidos',
  descricao: 'Os principais índices americanos encerraram a sessão sem direção única após a divulgação do dado de inflação. Investidores avaliaram as perspectivas para os juros, resultados corporativos e a reação das ações de tecnologia.',
  fonte: 'Money Times',
};

test('aprova notícia com manchete, fonte e contexto completos', () => {
  assert.equal(validarNoticiaParaPublicacao(noticiaCompleta).aprovada, true);
});

test('bloqueia manchete truncada antes de gerar feed e Story', () => {
  const resultado = validarNoticiaParaPublicacao({ ...noticiaCompleta, titulo: 'Brasil tem fluxo cambial positivo de US$ 652 milhões até dia...' });
  assert.equal(resultado.aprovada, false);
  assert.match(resultado.motivo, /incompleta/);
});

test('bloqueia notícia sem resumo contextualizado', () => {
  const resultado = validarNoticiaParaPublicacao({ ...noticiaCompleta, descricao: 'Mercado acompanha o dado.' });
  assert.equal(resultado.aprovada, false);
  assert.match(resultado.motivo, /contexto suficiente/);
});
