const test = require('node:test');
const assert = require('node:assert/strict');
const { selecionarNoticiaStory } = require('../auto-story-noticia.cjs');

test('Story seleciona notícia recente de impacto menor', () => {
  const agora = Date.parse('2026-08-10T15:00:00Z');
  const noticia = selecionarNoticiaStory([
    { link: 'alto', publicadoEm: agora - 1000, peso: 80 },
    { link: 'intermediario', publicadoEm: agora - 1000, peso: 65 },
    { link: 'baixo', publicadoEm: agora - 1000, peso: 42 },
  ], new Set(), agora);
  assert.equal(noticia.link, 'intermediario');
});

test('Story não reutiliza notícia já publicada nem notícia antiga', () => {
  const agora = Date.parse('2026-08-10T15:00:00Z');
  const noticia = selecionarNoticiaStory([
    { link: 'repetida', publicadoEm: agora - 1000, peso: 40 },
    { link: 'antiga', publicadoEm: agora - 3 * 60 * 60 * 1000, peso: 40 },
  ], new Set(['repetida']), agora);
  assert.equal(noticia, null);
});

test('Story aceita outra notícia dentro da janela de duas horas', () => {
  const agora = Date.parse('2026-08-10T15:00:00Z');
  const noticia = selecionarNoticiaStory([
    { link: 'recente', publicadoEm: agora - 90 * 60 * 1000, peso: 45 },
  ], new Set(), agora);
  assert.equal(noticia.link, 'recente');
});
