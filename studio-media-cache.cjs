const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function mediaCachePaths(root, link, index) {
  const key = crypto.createHash('sha256').update(`${link}\n${Math.max(0, Number(index) || 0)}`).digest('hex');
  const folder = path.join(root, 'news-media');
  return { folder, bytes: path.join(folder, `${key}.bin`), meta: path.join(folder, `${key}.json`) };
}

function readCachedMedia(root, link, index) {
  try {
    const files = mediaCachePaths(root, link, index);
    const meta = JSON.parse(fs.readFileSync(files.meta, 'utf8'));
    if (!/^image\/[a-z0-9.+-]+$/i.test(String(meta.type || ''))) return null;
    const bytes = fs.readFileSync(files.bytes);
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return { bytes, type: meta.type, savedAt: meta.savedAt || null };
  } catch { return null; }
}

function saveCachedMedia(root, link, index, type, bytes) {
  if (!/^image\/[a-z0-9.+-]+$/i.test(String(type || '')) || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Imagem inválida para o cache');
  const files = mediaCachePaths(root, link, index);
  fs.mkdirSync(files.folder, { recursive: true });
  fs.writeFileSync(files.bytes, bytes);
  fs.writeFileSync(files.meta, JSON.stringify({ type, savedAt: new Date().toISOString(), bytes: bytes.length }));
  return files;
}

module.exports = { MAX_IMAGE_BYTES, mediaCachePaths, readCachedMedia, saveCachedMedia };
