const test = require('node:test');
const assert = require('node:assert/strict');
const { montarFiltroVideoAnimado } = require('../gerar_tiktok.cjs');

test('reel usa movimento e transições entre as cenas', () => {
  const filtro = montarFiltroVideoAnimado(4, 4.5, 'C:/tmp/legendas.srt');
  assert.match(filtro, /zoompan/);
  assert.match(filtro, /xfade=transition=fade/);
  assert.match(filtro, /subtitles=/);
  assert.match(filtro, /\[vout\]/);
});
