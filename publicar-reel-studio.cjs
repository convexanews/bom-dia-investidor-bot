const { publicarReel, validarTokenInstagram, buscarCaptionsRecentes } = require('./utils.cjs');

function readInput(env = process.env) {
  const queueId = String(env.STUDIO_QUEUE_ID || '');
  const videoUrl = String(env.STUDIO_VIDEO_URL || '');
  let caption = '';
  try { caption = Buffer.from(String(env.STUDIO_CAPTION_B64 || ''), 'base64').toString('utf8').trim(); } catch {}
  if (!/^\d{17}$/.test(queueId)) throw new Error('Identificador do Studio inválido.');
  if (!/^https:\/\/raw\.githubusercontent\.com\/convexanews\/convexanews\.github\.io\/main\/bdi-studio\/reel-\d{17}\.(?:mp4|webm)$/.test(videoUrl)) throw new Error('URL de vídeo não autorizada.');
  if (!caption || caption.length > 2200) throw new Error('Legenda ausente ou maior que 2.200 caracteres.');
  return { queueId, videoUrl, caption };
}

async function main() {
  const { videoUrl, caption } = readInput();
  if (!await validarTokenInstagram()) throw new Error('Token do Instagram inválido ou expirado.');
  const firstLine = caption.split('\n')[0].trim(), recent = await buscarCaptionsRecentes();
  if (firstLine && recent.includes(firstLine)) throw new Error('Esta matéria já aparece entre as publicações recentes do Instagram.');
  const postId = await publicarReel(videoUrl, caption);
  console.log(`INSTAGRAM_POST_ID=${postId}`);
}

module.exports = { readInput };
if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });
