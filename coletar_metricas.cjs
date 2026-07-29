// Coleta indicadores que permitem comparar formatos, temas e horários de publicação.
const fs = require('fs');
const path = require('path');

const API = 'https://graph.instagram.com/v23.0';
const token = process.env.IG_TOKEN;
const accountId = process.env.IG_ACCOUNT_ID;
const relatorioPath = path.join(__dirname, 'relatorio.json');
const metricasPath = path.join(__dirname, 'metricas.json');
const resumoPath = path.join(__dirname, 'metricas-resumo.json');

function lerJson(arquivo, padrao) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return padrao; }
}

function resumoPorFormato(registros) {
  const grupos = new Map();
  for (const registro of registros) {
    const chave = registro.tipo || 'sem_formato';
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(registro.insights || {});
  }
  return Object.fromEntries([...grupos].map(([formato, itens]) => {
    const media = campo => {
      const valores = itens.map(i => Number(i[campo])).filter(Number.isFinite);
      return valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null;
    };
    return [formato, { posts: itens.length, alcanceMedio: media('reach'), salvamentosMedios: media('saved'), compartilhamentosMedios: media('shares'), reproducoesMedias: media('plays') }];
  }));
}

async function consultar(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Instagram respondeu ${resposta.status}`);
  return resposta.json();
}

async function metricasDoPost(id) {
  const metricas = ['reach', 'saved', 'shares', 'comments', 'likes', 'plays', 'total_interactions'];
  const resultado = {};
  for (const metrica of metricas) {
    try {
      const dados = await consultar(`${API}/${id}/insights?metric=${metrica}&access_token=${token}`);
      const item = (dados.data || [])[0];
      if (item) resultado[item.name] = item.values?.[0]?.value ?? null;
    } catch {
      // Métricas variam por formato e por versão da API. Uma indisponível não invalida as demais.
    }
  }
  return resultado;
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
        tipo: post.tipo, pilares: post.pilares || [], peso: post.peso, fonte: post.fonte, titulo: post.titulo,
        insights,
      });
    } catch (erro) {
      atualizadas.push(anteriores.get(post.postId) || { postId: post.postId, erro: erro.message });
    }
  }

  fs.writeFileSync(metricasPath, JSON.stringify(atualizadas, null, 2));
  fs.writeFileSync(resumoPath, JSON.stringify({ atualizadoEm: new Date().toISOString(), porFormato: resumoPorFormato(atualizadas) }, null, 2));
}

if (require.main === module) {
  main().catch(erro => { console.error(erro.message); process.exit(1); });
}

module.exports = { resumoPorFormato };
