const test = require('node:test');
const assert = require('node:assert/strict');
const { selecionarNoticiaStory, jaPublicouStoryHoje } = require('../auto-story-noticia.cjs');

test('Story seleciona notícia recente de impacto menor', () => {
  const agora = Date.parse('2026-08-10T15:00:00Z');
  const noticia = selecionarNoticiaStory([
    { link: 'alto', publicadoEm: agora - 1000, peso: 80 },
    { link: 'baixo', publicadoEm: agora - 1000, peso: 42 },
  ], new Set(), agora);
  assert.equal(noticia.link, 'baixo');
});

test('Story não reutiliza notícia já publicada nem notícia antiga', () => {
  const agora = Date.parse('2026-08-10T15:00:00Z');
  const noticia = selecionarNoticiaStory([
    { link: 'repetida', publicadoEm: agora - 1000, peso: 40 },
    { link: 'antiga', publicadoEm: agora - 2 * 60 * 60 * 1000, peso: 40 },
  ], new Set(['repetida']), agora);
  assert.equal(noticia, null);
});

test('Story limita publicação a uma vez no dia de Brasília', () => {
  const agora = new Date('2026-08-10T15:00:00Z');
  assert.equal(jaPublicouStoryHoje([{ data: '2026-08-10T12:00:00Z' }], agora), true);
  assert.equal(jaPublicouStoryHoje([{ data: '2026-08-09T12:00:00Z' }], agora), false);
});
