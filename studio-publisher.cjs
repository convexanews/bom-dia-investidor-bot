const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const BOT_REPO = 'convexanews/bom-dia-investidor-bot';
const PAGES_REPO = 'convexanews/convexanews.github.io';
const WORKFLOW = 'studio-publicar.yml';
const activeJobs = new Map();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function gh(args, options = {}) {
  const result = await execFileAsync('gh', args, { windowsHide: true, maxBuffer: 12 * 1024 * 1024, ...options });
  return String(result.stdout || '').trim();
}

function readMeta(metaFile) { return JSON.parse(fs.readFileSync(metaFile, 'utf8')); }
function updateMeta(metaFile, changes) {
  const meta = { ...readMeta(metaFile), ...changes };
  const temp = `${metaFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(meta, null, 2));
  fs.renameSync(temp, metaFile);
  return meta;
}

function safeError(error) {
  return String(error?.stderr || error?.message || error || 'Falha desconhecida')
    .replace(/access_token=[^&\s]+/gi, 'access_token=***').slice(0, 900);
}

function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { return require('ffmpeg-static'); }
  catch { return 'ffmpeg'; }
}

function argumentosInstagramMp4(input, output) {
  return [
    '-y', '-i', input,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '48000', '-b:a', '128k', '-movflags', '+faststart', '-shortest', output,
  ];
}

async function ensureInstagramMp4(videoFile, folder) {
  const output = path.join(folder, 'reel-instagram.mp4');
  try {
    await execFileAsync(ffmpegPath(), argumentosInstagramMp4(videoFile, output), {
      windowsHide: true, timeout: 8 * 60 * 1000, maxBuffer: 12 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`Não foi possível converter o Reel para MP4 H.264/AAC. Execute o preparador do Studio. ${safeError(error)}`);
  }
  if (!fs.existsSync(output) || fs.statSync(output).size < 10 * 1024) throw new Error('A conversão MP4 gerou um arquivo inválido.');
  return output;
}

async function existingSha(route) {
  try { return await gh(['api', route, '--jq', '.sha']); }
  catch (error) { if (/404|Not Found/i.test(safeError(error))) return ''; throw error; }
}

async function uploadFile(file, remotePath, message) {
  const route = `repos/${PAGES_REPO}/contents/${remotePath}`;
  const payloadFile = path.join(path.dirname(file), `.github-upload-${path.basename(remotePath)}.json`);
  const payload = { message, branch: 'main', content: fs.readFileSync(file).toString('base64') };
  const sha = await existingSha(route);
  if (sha) payload.sha = sha;
  fs.writeFileSync(payloadFile, JSON.stringify(payload));
  try { await gh(['api', '--method', 'PUT', route, '--input', payloadFile], { timeout: 180000 }); }
  finally { fs.rmSync(payloadFile, { force: true }); }
  return `https://raw.githubusercontent.com/${PAGES_REPO}/main/${remotePath}`;
}

async function uploadVideo(videoFile, id, folder = path.dirname(videoFile)) {
  const mp4 = await ensureInstagramMp4(videoFile, folder);
  return uploadFile(mp4, `bdi-studio/reel-${id}.mp4`, `Studio: Reel ${id}`);
}

async function uploadImages(folder, id, count, format) {
  const limit = format === 'carousel' ? Math.min(10, count) : 1;
  const urls = [];
  for (let index = 1; index <= limit; index++) {
    const file = path.join(folder, `slide-${index}.png`);
    if (!fs.existsSync(file)) throw new Error(`Imagem ${index} da criação não foi encontrada.`);
    urls.push(await uploadFile(file, `bdi-studio/post-${id}-${index}.png`, `Studio: ${format} ${id} imagem ${index}`));
  }
  return urls;
}

async function waitForPublicUrls(urls) {
  for (const url of urls) {
    let last = 'sem resposta';
    for (let attempt = 0; attempt < 24; attempt++) {
      try {
        const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
        if (response.ok) { last = ''; break; }
        last = `HTTP ${response.status}`;
      } catch (error) { last = error.message; }
      await wait(2500);
    }
    if (last) throw new Error(`A mídia não ficou disponível publicamente: ${last}`);
  }
}

function b64json(value) { return Buffer.from(JSON.stringify(value), 'utf8').toString('base64'); }

async function dispatchWorkflow(id, media, caption, origin = {}, format = 'reel', options = {}) {
  const startedAt = Date.now();
  const mediaList = Array.isArray(media) ? media : [media];
  const originPayload = {
    title: String(origin.title || '').slice(0, 300), link: String(origin.link || '').slice(0, 1000),
    source: String(origin.source || '').slice(0, 80), headline: String(origin.headline || '').slice(0, 300),
  };
  await gh([
    'workflow', 'run', WORKFLOW, '--repo', BOT_REPO,
    '-f', `queue_id=${id}`, '-f', `format=${format}`, '-f', `media_b64=${b64json(mediaList)}`,
    '-f', `caption_b64=${Buffer.from(caption, 'utf8').toString('base64')}`,
    '-f', `origin_b64=${b64json(originPayload)}`, '-f', `options_b64=${b64json(options)}`,
  ], { timeout: 30000 });
  for (let attempt = 0; attempt < 30; attempt++) {
    const output = await gh(['run', 'list', '--repo', BOT_REPO, '--workflow', WORKFLOW, '--event', 'workflow_dispatch', '--limit', '10', '--json', 'databaseId,displayTitle,status,conclusion,url,createdAt']);
    const runs = JSON.parse(output || '[]');
    const title = `Studio ${format} ${id}`;
    const run = runs.find(item => item.displayTitle === title && new Date(item.createdAt).getTime() >= startedAt - 15000);
    if (run) return run;
    await wait(2000);
  }
  throw new Error('A publicação foi enviada, mas a execução não apareceu no GitHub.');
}

async function waitForRun(run) {
  let current = run;
  for (let attempt = 0; attempt < 120; attempt++) {
    current = JSON.parse(await gh(['run', 'view', String(run.databaseId), '--repo', BOT_REPO, '--json', 'status,conclusion,url']));
    if (current.status === 'completed') return current;
    await wait(5000);
  }
  throw new Error('Tempo esgotado aguardando a publicação no Instagram.');
}

async function publicationJob({ id, folder, metaFile }) {
  try {
    const meta = readMeta(metaFile);
    const format = meta.project?.format || 'feed';
    updateMeta(metaFile, { status: 'enviando-midia', publicationError: null, publishAttemptAt: new Date().toISOString() });
    let media;
    const options = { ...(meta.project?.publicationOptions || {}) };
    if (format === 'reel') {
      const videoFile = path.join(folder, meta.video);
      media = [await uploadVideo(videoFile, id, folder)];
      const cover = path.join(folder, 'slide-1.png');
      if (fs.existsSync(cover)) options.coverUrl = await uploadFile(cover, `bdi-studio/post-${id}-1.png`, `Studio: capa do Reel ${id}`);
    } else {
      media = await uploadImages(folder, id, meta.project?.slides?.length || 1, format);
    }
    await waitForPublicUrls([...media, ...(options.coverUrl ? [options.coverUrl] : [])]);
    updateMeta(metaFile, { status: 'acionando-instagram', publishedMediaUrls: media });
    const origin = { ...(meta.project?.originNews || {}), headline: meta.project?.slides?.[0]?.headline || '' };
    const run = await dispatchWorkflow(id, media, String(meta.caption || '').slice(0, 2200), origin, format, options);
    updateMeta(metaFile, { status: 'publicando-instagram', publicationRunUrl: run.url });
    const finished = await waitForRun(run);
    if (finished.conclusion !== 'success') throw new Error(`A Action terminou com status ${finished.conclusion || 'desconhecido'}. Consulte ${finished.url}`);
    let postId = null;
    try {
      const logs = await gh(['run', 'view', String(run.databaseId), '--repo', BOT_REPO, '--log'], { timeout: 30000 });
      postId = (/INSTAGRAM_POST_ID=([0-9]+)/.exec(logs) || [])[1] || null;
    } catch {}
    updateMeta(metaFile, { status: 'publicado', publishedAt: new Date().toISOString(), instagramPostId: postId, publicationError: null });
  } catch (error) {
    updateMeta(metaFile, { status: 'erro-publicacao', publicationError: safeError(error), publicationFailedAt: new Date().toISOString() });
  } finally { activeJobs.delete(id); }
}

function startPublication(options) {
  if (activeJobs.has(options.id)) return false;
  const job = publicationJob(options);
  activeJobs.set(options.id, job);
  return true;
}

module.exports = {
  startPublication, safeError, uploadVideo, uploadImages, dispatchWorkflow,
  argumentosInstagramMp4, ensureInstagramMp4, ffmpegPath,
};
