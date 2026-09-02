const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gerarLegendasStudio, montarFiltroVideoAnimado, validarTextoNarracaoEmPortugues, VOZ_TTS_PRIMARIA, VOZ_TTS_RESERVA } = require('../gerar_tiktok.cjs');

test('reel usa movimento e transições entre as cenas', () => {
  const filtro = montarFiltroVideoAnimado(4, 4.5, 'C:/tmp/legendas.ass');
  assert.match(filtro, /scale=1080:1920/);
  assert.doesNotMatch(filtro, /crop=/);
  assert.match(filtro, /fade=t=out/);
  const primeiraCena = filtro.split('[v0]')[0];
  assert.doesNotMatch(primeiraCena, /fade=t=in/);
  assert.match(filtro, /\[1:v\][^;]+fade=t=in/);
  assert.match(filtro, /concat=n=4:v=1:a=0/);
  assert.match(filtro, /subtitles=/);
  assert.match(filtro, /\[vout\]/);
});

test('legendas do Studio são curtas, previsíveis e não cobrem o texto editorial', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-legendas-'));
  const arquivo = path.join(pasta, 'legendas.ass');
  const resultado = gerarLegendasStudio([
    { titulo: 'O que aconteceu', texto: 'No câmbio, o dólar comercial avança sobre o real, enquanto o mercado acompanha os dados do trabalho no Brasil.' },
    { titulo: 'Por que importa', texto: 'A reação dos juros pode mudar a leitura dos investidores.' },
  ], 12, arquivo);

  assert.ok(resultado.blocos >= 4);
  assert.match(resultado.conteudo, /PlayResX: 1080/);
  assert.match(resultado.conteudo, /PlayResY: 1920/);
  assert.match(resultado.conteudo, /Fontsize, PrimaryColour/);
  assert.match(resultado.conteudo, /Style: Legenda,Arial,34/);
  assert.match(resultado.conteudo, /Alignment, MarginL, MarginR, MarginV/);
  assert.match(resultado.conteudo, /,8,130,130,410,1/);
  assert.doesNotMatch(resultado.conteudo, /No câmbio, o dólar comercial avança sobre o real, enquanto o mercado acompanha os dados do trabalho no Brasil\./);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test('narração exige português e usa apenas vozes pt-BR não multilíngues', () => {
  assert.equal(validarTextoNarracaoEmPortugues('O mercado reagiu aos dados de inflação e os investidores acompanham a notícia.'), 'O mercado reagiu aos dados de inflação e os investidores acompanham a notícia.');
  assert.throws(() => validarTextoNarracaoEmPortugues('Los mercados también reaccionaron después de los datos de inflación.'), /espanhol/);
  assert.match(VOZ_TTS_PRIMARIA, /^pt-BR-/);
  assert.match(VOZ_TTS_RESERVA, /^pt-BR-/);
  assert.doesNotMatch(VOZ_TTS_PRIMARIA, /Multilingual/i);
  assert.doesNotMatch(VOZ_TTS_RESERVA, /Multilingual/i);
});
