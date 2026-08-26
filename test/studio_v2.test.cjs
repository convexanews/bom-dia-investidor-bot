const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { limparTextoNarracao, validarConfiguracao, chaveNarracao, mensagemErroNarracao, estimarDuracaoNarracao } = require('../studio-audio.cjs');
const { normalizarMidiaInstagram } = require('../sincronizar-instagram-studio.cjs');
const { validarAgendamento, agendar, lerAgenda } = require('../studio-agenda.cjs');
const { argumentosInstagramMp4, argumentosStoryComMusica, safeError } = require('../studio-publisher.cjs');
const { readInput } = require('../publicar-studio.cjs');

test('narração remove links e limita configurações de voz', () => {
  const text = limparTextoNarracao('Bitcoin avançou hoje. Veja https://example.com a matéria completa para entender o movimento do mercado.');
  assert.doesNotMatch(text, /https/);
  const config = validarConfiguracao({ voice: 'voz-inexistente', rate: 90, pitch: -80, volume: 120 });
  assert.equal(config.voice, 'pt-BR-FranciscaNeural');
  assert.equal(config.rate, '+30%');
  assert.equal(config.pitch, '-20%');
  assert.equal(config.volume, '+50%');
  assert.ok(estimarDuracaoNarracao(text) >= 3);
});

test('narração usa chave estável por texto e configuração', () => {
  const base = { texto: 'O Ibovespa avançou hoje enquanto investidores acompanharam os juros.', voice: 'pt-BR-FranciscaNeural', rate: -4 };
  assert.equal(chaveNarracao(base), chaveNarracao({ ...base }));
  assert.notEqual(chaveNarracao(base), chaveNarracao({ ...base, voice: 'pt-BR-AntonioNeural' }));
});

test('falha vazia do provedor de voz vira orientação compreensível', () => {
  assert.match(mensagemErroNarracao({}), /internet.*tente novamente/i);
  assert.match(mensagemErroNarracao(new Error('O módulo de narração instalado é incompatível.')), /incompatível/i);
});

test('espelho normaliza Reel e usa thumbnail como capa', () => {
  const item = normalizarMidiaInstagram({ id: 10, media_type: 'VIDEO', media_product_type: 'REELS', media_url: 'video.mp4', thumbnail_url: 'cover.jpg', permalink: 'https://instagram.com/reel/x', children: { data: [] } });
  assert.equal(item.id, '10');
  assert.equal(item.productType, 'REELS');
  assert.equal(item.thumbnailUrl, 'cover.jpg');
});

test('agenda persiste projeto aprovado para horário futuro', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-agenda-'));
  const file = path.join(dir, 'agenda.json');
  const scheduledAt = new Date(Date.now() + 120000).toISOString();
  const validated = validarAgendamento({ queueId: '20260825123456789', scheduledAt });
  assert.equal(validated.queueId, '20260825123456789');
  agendar(validated, file);
  assert.equal(lerAgenda(file).length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('pipeline MP4 força H.264, AAC, 48 kHz e faststart', () => {
  const args = argumentosInstagramMp4('input.webm', 'output.mp4').join(' ');
  assert.match(args, /libx264/);
  assert.match(args, /aac/);
  assert.match(args, /48000/);
  assert.match(args, /\+faststart/);
});

test('erro 401 do GitHub orienta reconexão sem expor mensagem técnica', () => {
  assert.match(safeError({ stderr: 'gh: Requires authentication (HTTP 401)' }), /GitHub desconectado.*convexanews/i);
});

test('Story musical limita duração e volume e gera vídeo compatível', () => {
  const args = argumentosStoryComMusica('story.png', 'news.mp3', 'story.mp4', { duration: 12, volume: .18 }).join(' ');
  assert.match(args, /-loop 1/);
  assert.match(args, /-t 12/);
  assert.match(args, /volume=0\.18/);
  assert.match(args, /libx264/);
  assert.match(args, /aac/);
  assert.match(args, /48000/);
});

test('publicador geral aceita carrossel autorizado e bloqueia WebM em Reel', () => {
  const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64');
  const base = { STUDIO_QUEUE_ID: '20260825123456789', STUDIO_CAPTION_B64: b64('Mercado hoje\n\nConteúdo informativo.'), STUDIO_ORIGIN_B64: b64({ source: 'BDI' }), STUDIO_OPTIONS_B64: b64({}) };
  const carousel = readInput({ ...base, STUDIO_FORMAT: 'carousel', STUDIO_MEDIA_B64: b64(['https://raw.githubusercontent.com/convexanews/convexanews.github.io/main/bdi-studio/post-20260825123456789-1.png']) });
  assert.equal(carousel.format, 'carousel');
  const story = readInput({ ...base, STUDIO_FORMAT: 'story', STUDIO_OPTIONS_B64: b64({ storyVideo: true }), STUDIO_MEDIA_B64: b64(['https://raw.githubusercontent.com/convexanews/convexanews.github.io/main/bdi-studio/story-20260825123456789.mp4']) });
  assert.equal(story.options.storyVideo, true);
  assert.throws(() => readInput({ ...base, STUDIO_FORMAT: 'reel', STUDIO_MEDIA_B64: b64(['https://raw.githubusercontent.com/convexanews/convexanews.github.io/main/bdi-studio/reel-20260825123456789.webm']) }), /não autorizada|MP4/);
});
