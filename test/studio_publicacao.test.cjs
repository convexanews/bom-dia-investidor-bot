const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readInput, registrarHistorico } = require('../publicar-reel-studio.cjs');
const { safeError } = require('../studio-publisher.cjs');

test('publicação do Studio aceita somente vídeo hospedado no repositório autorizado', () => {
  const input = readInput({
    STUDIO_QUEUE_ID: '20260821170048502',
    STUDIO_VIDEO_URL: 'https://raw.githubusercontent.com/convexanews/convexanews.github.io/main/bdi-studio/reel-20260821170048502.mp4',
    STUDIO_CAPTION_B64: Buffer.from('Bitcoin em alta\n\nConteúdo informativo.').toString('base64'),
    STUDIO_ORIGIN_B64: Buffer.from(JSON.stringify({ title: 'Bom dia, bitcoin', link: 'https://exemplo.com/bitcoin', source: 'Fonte Exemplo' })).toString('base64'),
  });
  assert.equal(input.queueId, '20260821170048502');
  assert.match(input.caption, /Bitcoin em alta/);
  assert.equal(input.origin.link, 'https://exemplo.com/bitcoin');
  assert.throws(() => readInput({ ...process.env, STUDIO_QUEUE_ID: '20260821170048502', STUDIO_VIDEO_URL: 'https://site-malicioso.test/video.mp4', STUDIO_CAPTION_B64: Buffer.from('Legenda').toString('base64') }), /não autorizada/);
});

test('erros de publicação não preservam token em URLs', () => {
  assert.doesNotMatch(safeError(new Error('falha access_token=segredo123&x=1')), /segredo123/);
});

test('Reel do Studio registra link e publicação para deduplicação online', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-studio-history-'));
  fs.writeFileSync(path.join(root, 'noticias-postadas.json'), '[]');
  fs.writeFileSync(path.join(root, 'relatorio.json'), '[]');
  registrarHistorico({ videoUrl: 'https://raw.githubusercontent.com/video.mp4', origin: { title: 'Bom dia, bitcoin', link: 'https://exemplo.com/bitcoin', source: 'Money Times', headline: 'Bitcoin acelera' } }, '123456789', root);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'noticias-postadas.json'))), ['https://exemplo.com/bitcoin']);
  const report = JSON.parse(fs.readFileSync(path.join(root, 'relatorio.json')));
  assert.equal(report[0].reelId, '123456789');
  assert.equal(report[0].origem, 'studio-local');
  fs.rmSync(root, { recursive: true, force: true });
});

