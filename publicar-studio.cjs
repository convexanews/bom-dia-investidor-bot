const fs = require('fs');
const path = require('path');
const {
  publicarFeed, publicarReel, publicarStory, publicarCarrossel,
  validarTokenInstagram, buscarCaptionsRecentes,
} = require('./utils.cjs');

function decodeBase64(value) {
  try { return Buffer.from(String(value || ''), 'base64').toString('utf8'); } catch { return ''; }
}

function parseBase64Json(value, fallback) {
  try { return JSON.parse(decodeBase64(value) || JSON.stringify(fallback)); }
  catch { throw new Error('Metadados do Studio inválidos.'); }
}

function readInput(env = process.env) {
  const queueId = String(env.STUDIO_QUEUE_ID || '');
  const format = String(env.STUDIO_FORMAT || 'reel');
  const caption = decodeBase64(env.STUDIO_CAPTION_B64).trim();
  const media = parseBase64Json(env.STUDIO_MEDIA_B64, []);
  let origin = parseBase64Json(env.STUDIO_ORIGIN_B64, {});
  const options = parseBase64Json(env.STUDIO_OPTIONS_B64, {});
  if (!/^\d{17}$/.test(queueId)) throw new Error('Identificador do Studio inválido.');
  if (!['feed', 'story', 'carousel', 'reel'].includes(format)) throw new Error('Formato do Studio inválido.');
  if (!Array.isArray(media) || !media.length || media.length > 10) throw new Error('Lista de mídias inválida.');
  const allowed = /^https:\/\/raw\.githubusercontent\.com\/convexanews\/convexanews\.github\.io\/main\/bdi-studio\/(?:reel|story|post)-\d{17}(?:-\d+)?\.(?:mp4|png|jpe?g)$/i;
  if (media.some(url => !allowed.test(String(url)))) throw new Error('URL de mídia não autorizada.');
  if (format === 'reel' && !/\.mp4$/i.test(media[0])) throw new Error('Reels precisam estar em MP4.');
  if (format === 'story' && options.storyVideo === true && !/\.mp4$/i.test(media[0])) throw new Error('Story com música precisa estar em MP4.');
  if (format !== 'story' && (!caption || caption.length > 2200)) throw new Error('Legenda ausente ou maior que 2.200 caracteres.');
  origin = {
    title: String(origin.title || '').slice(0, 300), link: String(origin.link || '').slice(0, 1000),
    source: String(origin.source || '').slice(0, 80), headline: String(origin.headline || '').slice(0, 300),
  };
  if (origin.link && !/^https?:\/\//i.test(origin.link)) throw new Error('Link original da pauta inválido.');
  return { queueId, format, caption, media, origin, options };
}

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }

function registrarHistorico(input, postId, root = __dirname) {
  const linksFile = path.join(root, 'noticias-postadas.json');
  const reportFile = path.join(root, 'relatorio.json');
  const links = readJson(linksFile, []);
  if (input.origin.link && !links.includes(input.origin.link)) links.unshift(input.origin.link);
  writeJson(linksFile, links.slice(0, 1000));
  const report = readJson(reportFile, []);
  const already = report.some(item => (input.origin.link && item.link === input.origin.link) || (postId && (item.postId === postId || item.reelId === postId)));
  if (!already) report.unshift({
    data: new Date().toISOString(), titulo: input.origin.title || input.origin.headline || 'Criação do Studio',
    categoria: 'Studio', fonte: input.origin.source || 'Bom Dia Investidor', link: input.origin.link || '',
    postId: postId || null, storyId: input.format === 'story' ? postId : null,
    reelId: input.format === 'reel' ? postId : null, imagemFeed: input.format !== 'reel' ? input.media[0] : null,
    imagemStory: input.format === 'story' && !input.options.storyVideo ? input.media[0] : null, videoUrl: input.format === 'reel' || input.options.storyVideo ? input.media[0] : null,
    tipo: `${input.format}-studio`, peso: null, origem: 'studio-local',
  });
  writeJson(reportFile, report.slice(0, 1000));
}

async function publicar(input) {
  if (input.format === 'reel') return publicarReel(input.media[0], input.caption, {
    shareToFeed: input.options.shareToFeed !== false,
    coverUrl: String(input.options.coverUrl || ''), thumbOffset: Number(input.options.thumbOffset) || 0,
  });
  if (input.format === 'story') return publicarStory(input.media[0], { video: input.options.storyVideo === true });
  if (input.format === 'carousel') return publicarCarrossel(input.media, input.caption, { altTexts: input.options.altTexts || [] });
  return publicarFeed(input.media[0], input.caption, { altText: input.options.altTexts?.[0] });
}

async function main() {
  const input = readInput();
  if (!await validarTokenInstagram()) throw new Error('Token do Instagram inválido ou expirado.');
  const firstLine = input.caption.split('\n')[0].trim();
  const recent = input.format === 'story' ? [] : await buscarCaptionsRecentes();
  const alreadyPublished = firstLine && recent.includes(firstLine);
  const postId = alreadyPublished ? null : await publicar(input);
  registrarHistorico(input, postId);
  if (alreadyPublished) console.log('INSTAGRAM_ALREADY_PUBLISHED=1');
  else console.log(`INSTAGRAM_POST_ID=${postId}`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });

module.exports = { readInput, registrarHistorico, publicar };
