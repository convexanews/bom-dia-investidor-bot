const { publicarReel, validarTokenInstagram, buscarCaptionsRecentes } = require('./utils.cjs');
const fs = require('fs');
const path = require('path');

function decodeBase64(value) {
  try { return Buffer.from(String(value || ''), 'base64').toString('utf8'); } catch { return ''; }
}

function readInput(env = process.env) {
  const queueId = String(env.STUDIO_QUEUE_ID || '');
  const videoUrl = String(env.STUDIO_VIDEO_URL || '');
  const caption = decodeBase64(env.STUDIO_CAPTION_B64).trim();
  let origin = {};
  try { origin = JSON.parse(decodeBase64(env.STUDIO_ORIGIN_B64) || '{}'); } catch { throw new Error('Origem da pauta inválida.'); }
  if (!/^\d{17}$/.test(queueId)) throw new Error('Identificador do Studio inválido.');
  if (!/^https:\/\/raw\.githubusercontent\.com\/convexanews\/convexanews\.github\.io\/main\/bdi-studio\/reel-\d{17}\.(?:mp4|webm)$/.test(videoUrl)) throw new Error('URL de vídeo não autorizada.');
  if (!caption || caption.length > 2200) throw new Error('Legenda ausente ou maior que 2.200 caracteres.');
  origin = { title: String(origin.title || '').slice(0, 300), link: String(origin.link || '').slice(0, 1000), source: String(origin.source || '').slice(0, 80), headline: String(origin.headline || '').slice(0, 300) };
  if (origin.link && !/^https?:\/\//i.test(origin.link)) throw new Error('Link original da pauta inválido.');
  return { queueId, videoUrl, caption, origin };
}

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
function registrarHistorico({ videoUrl, origin }, postId, root = __dirname) {
  const linksFile = path.join(root, 'noticias-postadas.json'), reportFile = path.join(root, 'relatorio.json');
  const links = readJson(linksFile, []); if (origin.link && !links.includes(origin.link)) links.unshift(origin.link); writeJson(linksFile, links.slice(0, 1000));
  const report = readJson(reportFile, []), already = report.some(item => (origin.link && item.link === origin.link) || (postId && (item.postId === postId || item.reelId === postId)));
  if (!already) report.unshift({ data: new Date().toISOString(), titulo: origin.title || origin.headline || 'Reel criado no Studio', categoria: 'Studio', fonte: origin.source || 'Bom Dia Investidor', link: origin.link || '', postId: postId || null, storyId: null, reelId: postId || null, imagemFeed: null, imagemStory: null, videoUrl, tipo: 'reel-studio', peso: null, origem: 'studio-local' });
  writeJson(reportFile, report.slice(0, 1000));
}

async function main() {
  const input = readInput(), { videoUrl, caption } = input;
  if (!await validarTokenInstagram()) throw new Error('Token do Instagram inválido ou expirado.');
  const firstLine = caption.split('\n')[0].trim(), recent = await buscarCaptionsRecentes();
  const alreadyPublished = firstLine && recent.includes(firstLine);
  const postId = alreadyPublished ? null : await publicarReel(videoUrl, caption);
  registrarHistorico(input, postId);
  if (alreadyPublished) console.log('INSTAGRAM_ALREADY_PUBLISHED=1');
  else console.log(`INSTAGRAM_POST_ID=${postId}`);
}

module.exports = { readInput, registrarHistorico };
if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });
