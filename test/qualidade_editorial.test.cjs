const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPautaAutomatica } = require('../qualidade_editorial.cjs');

test('aprova pauta de exterior com contexto suficiente', () => {
  const resultado = validarPautaAutomatica({
    manchete: 'Wall Street abre em alta com dados de emprego no radar',
    resumo: 'Os índices americanos começaram o dia positivos após dados de emprego, enquanto investidores acompanham os Treasuries e a próxima decisão do Fed.',
    tema: 'exterior',
  });
  assert.equal(resultado.aprovada, true);
});

test('reprova pauta curta sem contexto editorial', () => {
  const resultado = validarPautaAutomatica({ manchete: 'Mercado sobe', resumo: 'Pouca informação.', tema: 'selic' });
  assert.equal(resultado.aprovada, false);
});

test('reprova tema que não corresponde ao conteúdo', () => {
  const resultado = validarPautaAutomatica({
    manchete: 'Wall Street abre em alta com tecnologia no foco',
    resumo: 'Os índices americanos sobem com tecnologia e balanços corporativos no radar durante a abertura desta sessão.',
    tema: 'selic',
  });
  assert.equal(resultado.aprovada, false);
});
