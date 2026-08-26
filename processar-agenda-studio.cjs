const fs = require('fs');
const path = require('path');
const { publicar, registrarHistorico } = require('./publicar-studio.cjs');
const { validarTokenInstagram, buscarCaptionsRecentes } = require('./utils.cjs');
const {
  LOCAL_CLOUD_FILE, readLocalCloudAgenda, writeLocalCloudAgenda,
  dueCloudItems, inputFromCloudItem, retryChanges,
} = require('./studio-cloud-agenda.cjs');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function alreadyInHistory(input, root = __dirname) {
  if (!input.origin.link) return false;
  const links = readJson(path.join(root, 'noticias-postadas.json'), []);
  return links.includes(input.origin.link);
}

async function processCloudAgenda({ now = new Date(), file = LOCAL_CLOUD_FILE, root = __dirname } = {}) {
  const items = readLocalCloudAgenda(file);
  const due = dueCloudItems(items, now.getTime());
  if (!due.length) {
    console.log('STUDIO_CLOUD_DUE=0');
    return { processed: 0, published: 0, duplicates: 0, failures: 0 };
  }
  if (!await validarTokenInstagram()) throw new Error('Token do Instagram inválido ou expirado.');
  let recentCaptions = await buscarCaptionsRecentes();
  const result = { processed: 0, published: 0, duplicates: 0, failures: 0 };
  for (const dueItem of due) {
    const index = items.findIndex(item => item.queueId === dueItem.queueId);
    if (index < 0) continue;
    const attemptAt = new Date();
    items[index] = { ...items[index], status: 'publicando', lastAttemptAt: attemptAt.toISOString(), error: null };
    writeLocalCloudAgenda(items, file);
    try {
      const input = inputFromCloudItem(items[index]);
      const firstLine = input.caption.split('\n')[0].trim();
      const duplicate = alreadyInHistory(input, root) || (input.format !== 'story' && firstLine && recentCaptions.includes(firstLine));
      if (duplicate) {
        items[index] = { ...items[index], status: 'ignorado-duplicado', finishedAt: new Date().toISOString(), error: null };
        result.duplicates++;
      } else {
        const postId = await publicar(input);
        registrarHistorico(input, postId, root);
        items[index] = { ...items[index], status: 'publicado', instagramPostId: postId, publishedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), error: null };
        if (firstLine) recentCaptions = [firstLine, ...recentCaptions];
        console.log(`INSTAGRAM_POST_ID=${postId}`);
        result.published++;
      }
    } catch (error) {
      items[index] = { ...items[index], ...retryChanges(items[index], error, new Date()) };
      console.error(`STUDIO_CLOUD_ERROR=${items[index].queueId}: ${items[index].error}`);
      result.failures++;
    }
    result.processed++;
    writeLocalCloudAgenda(items, file);
  }
  console.log(`STUDIO_CLOUD_RESULT=${JSON.stringify(result)}`);
  return result;
}

if (require.main === module) {
  processCloudAgenda().then(result => { if (result.failures) process.exitCode = 1; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { alreadyInHistory, processCloudAgenda };
