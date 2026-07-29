// Coleta indicadores que permitem comparar formatos, temas e horários de publicação.
const fs = require('fs');
const path = require('path');

const API = 'https://graph.instagram.com/v23.0';
const token = process.env.IG_TOKEN;
const accountId = process.env.IG_ACCOUNT_ID;
const relatorioPath = path.join(__dirname, 'relatorio.json');
const metricasPath = path.join(__dirname, 'metricas.json');

function lerJson(arquivo, padrao) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return padrao; }
}

async function consultar(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Instagram respondeu ${resposta.status}`);
  return resposta.json();
}

async function metricasDoPost(id) {
  const metricas = ['reach', 'saved', 'shares', 'comments', 'likes', 'plays', 'total_interactions'];
  const url = `${API}/${id}/insights?metric=${metricas.join(',')}&access_token=${token}`;
  const dados = await consultar(url);
  return Object.fromEntries((dados.data || []).map(item => [item.name, item.values?.[0]?.value ?? null]));
}

async function main() {
  if (!token || !accountId) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const posts = lerJson(relatorioPath, []).filter(p => p.postId).slice(0, 60);
  const anteriores = new Map(lerJson(metricasPath, []).map(m => [m.postId, m]));
  const atualizadas = [];

  for (const post of posts) {
    try {
      const insights = await metricasDoPost(post.postId);
      atualizadas.push({
        postId: post.postId, dataColeta: new Date().toISOString(), dataPostagem: post.data,
        tipo: post.tipo, peso: post.peso, fonte: post.fonte, titulo: post.titulo,
        insights,
      });
    } catch (erro) {
      atualizadas.push(anteriores.get(post.postId) || { postId: post.postId, erro: erro.message });
    }
  }

  fs.writeFileSync(metricasPath, JSON.stringify(atualizadas, null, 2));
}

main().catch(erro => { console.error(erro.message); process.exit(1); });
