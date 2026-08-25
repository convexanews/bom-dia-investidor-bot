const path = require('path');
const { salvarJson, fetchComRetry } = require('./utils.cjs');

const API = process.env.IG_API_BASE || 'https://graph.instagram.com/v23.0';
const OUTPUT = path.join(__dirname, 'instagram-studio.json');

function normalizarMidiaInstagram(item = {}) {
  const children = Array.isArray(item.children?.data) ? item.children.data : [];
  return {
    id: String(item.id || ''),
    caption: String(item.caption || ''),
    mediaType: String(item.media_type || ''),
    productType: String(item.media_product_type || ''),
    mediaUrl: String(item.media_url || ''),
    thumbnailUrl: String(item.thumbnail_url || item.media_url || ''),
    permalink: String(item.permalink || ''),
    timestamp: item.timestamp || null,
    children: children.map(child => ({
      id: String(child.id || ''),
      mediaType: String(child.media_type || ''),
      mediaUrl: String(child.media_url || ''),
      thumbnailUrl: String(child.thumbnail_url || child.media_url || ''),
    })),
    insights: item.insights || {},
  };
}

async function consultar(url) {
  const resposta = await fetchComRetry(url, {}, { tentativas: 3, timeoutMs: 20_000 });
  const dados = await resposta.json();
  if (!resposta.ok || dados.error) throw new Error(dados.error?.message || `Instagram respondeu ${resposta.status}`);
  return dados;
}

async function buscarInsights(id, productType) {
  const metricas = String(productType).toUpperCase() === 'REELS'
    ? 'reach,likes,comments,saved,shares,views,total_interactions,ig_reels_avg_watch_time'
    : 'reach,likes,comments,saved,shares,total_interactions';
  try {
    const data = await consultar(`${API}/${id}/insights?metric=${metricas}&access_token=${encodeURIComponent(process.env.IG_TOKEN)}`);
    return Object.fromEntries((data.data || []).map(item => [item.name, item.values?.[0]?.value ?? item.total_value?.value ?? null]));
  } catch (error) {
    return { warning: error.message };
  }
}

async function sincronizarInstagram() {
  const token = process.env.IG_TOKEN;
  const accountId = process.env.IG_ACCOUNT_ID;
  if (!token || !accountId) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}';
  const payload = await consultar(`${API}/${accountId}/media?fields=${encodeURIComponent(fields)}&limit=50&access_token=${encodeURIComponent(token)}`);
  const items = [];
  for (const raw of payload.data || []) {
    const item = normalizarMidiaInstagram(raw);
    item.insights = await buscarInsights(item.id, item.productType);
    items.push(item);
  }
  const result = { updatedAt: new Date().toISOString(), accountId: String(accountId), items };
  salvarJson(OUTPUT, result);
  return result;
}

if (require.main === module) {
  sincronizarInstagram()
    .then(result => console.log(`Instagram sincronizado: ${result.items.length} publicação(ões).`))
    .catch(error => { console.error(error.message); process.exit(1); });
}

module.exports = { normalizarMidiaInstagram, sincronizarInstagram, buscarInsights };
