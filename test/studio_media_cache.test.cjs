const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readCachedMedia, saveCachedMedia } = require('../studio-media-cache.cjs');

test('cache de imagens sobrevive ao reinício do servidor', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-media-cache-'));
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  saveCachedMedia(root, 'https://site.com/noticia', 0, 'image/jpeg', bytes);
  const cached = readCachedMedia(root, 'https://site.com/noticia', 0);
  assert.equal(cached.type, 'image/jpeg');
  assert.deepEqual(cached.bytes, bytes);
  assert.equal(readCachedMedia(root, 'https://site.com/noticia', 1), null);
  fs.rmSync(root, { recursive: true, force: true });
});
