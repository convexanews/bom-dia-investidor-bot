const test = require('node:test');
const assert = require('node:assert/strict');
const { criarCapaRetencao, dividirResumoCurto, montarRoteiroReel, montarCenasReel, quebrarLegendas, montarRoteiroCarrossel } = require('../formato_editorial.cjs');

test('capa mantém o fato e reduz uma manchete longa', () => {
  const capa = criarCapaRetencao('Vale (VALE3) tem lucro 43% menor no 2T26 e revisa guidance de custos do minério', 'Empresas');
  assert.match(capa.gancho, /Vale/);
  assert.ok(capa.gancho.length <= 73);
});

test('resumo é dividido em blocos curtos', () => {
  const blocos = dividirResumoCurto('Primeiro fato relevante para o investidor. Segundo fato com contexto adicional. Terceiro fato para acompanhar no próximo pregão.', 3, 55);
  assert.ok(blocos.length >= 2);
  assert.ok(blocos.every(bloco => bloco.length <= 56));
});

test('roteiro e legendas mantêm leitura rápida', () => {
  const roteiro = montarRoteiroReel({ manchete: 'Selic entra no radar do mercado', resumo: 'O mercado aguarda o comunicado do Copom e procura sinais para a próxima reunião.', categoria: 'Economia' });
  assert.ok(roteiro.length >= 2);
  assert.ok(quebrarLegendas(roteiro, 45).every(legenda => legenda.length <= 45));
});

test('carrossel narrativo cria quatro etapas internas para totalizar seis imagens', () => {
  const roteiro = montarRoteiroCarrossel({
    manchete: 'Empresa divulga resultado e revisa projeções para o ano',
    resumo: 'A companhia divulgou o resultado trimestral. O mercado acompanha os próximos dados e a reação das ações.',
    categoria: 'Empresas',
    sentimento: 'positivo',
  });
  assert.equal(roteiro.length, 4);
  assert.ok(roteiro.every(slide => slide.kicker && slide.texto && slide.destaque));
  assert.ok(roteiro.every(slide => slide.tema === 'positivo'));
});

test('reel narrativo organiza o roteiro em quatro cenas de vídeo', () => {
  const cenas = montarCenasReel({
    manchete: 'Copom mantém juros e mercado acompanha comunicado',
    resumo: 'O Comitê divulgou a decisão após a reunião desta quarta-feira.',
    categoria: 'Economia',
    sentimento: { tipo: 'negativo' },
  });
  assert.equal(cenas.length, 4);
  assert.equal(cenas[0].tema, 'negativo');
  assert.ok(cenas.every(cena => cena.titulo && cena.texto && cena.chamada));
});
