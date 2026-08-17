const test = require('node:test');
const assert = require('node:assert/strict');
const { montarFiltroVideoAnimado, validarTextoNarracaoEmPortugues, VOZ_TTS_PRIMARIA, VOZ_TTS_RESERVA } = require('../gerar_tiktok.cjs');

test('reel usa movimento e transições entre as cenas', () => {
  const filtro = montarFiltroVideoAnimado(4, 4.5, 'C:/tmp/legendas.srt');
  assert.match(filtro, /zoompan/);
  assert.match(filtro, /xfade=transition=fade/);
  assert.match(filtro, /subtitles=/);
  assert.match(filtro, /\[vout\]/);
});

test('narração exige português e usa apenas vozes pt-BR não multilíngues', () => {
  assert.equal(validarTextoNarracaoEmPortugues('O mercado reagiu aos dados de inflação e os investidores acompanham a notícia.'), 'O mercado reagiu aos dados de inflação e os investidores acompanham a notícia.');
  assert.throws(() => validarTextoNarracaoEmPortugues('Los mercados también reaccionaron después de los datos de inflación.'), /espanhol/);
  assert.match(VOZ_TTS_PRIMARIA, /^pt-BR-/);
  assert.match(VOZ_TTS_RESERVA, /^pt-BR-/);
  assert.doesNotMatch(VOZ_TTS_PRIMARIA, /Multilingual/i);
  assert.doesNotMatch(VOZ_TTS_RESERVA, /Multilingual/i);
});
