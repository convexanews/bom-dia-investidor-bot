// Busca a imagem editorial da matéria e a incorpora no card para que fontes
// externas não bloqueiem o carregamento por hotlink/referer.
function extrairImagemOg(html) {
  const texto = String(html || '');
  const match = texto.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || texto.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

async function buscarImagemArtigo(link) {
  if (!link) return null;
  try {
    const resp = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) return null;
    return extrairImagemOg(await resp.text());
  } catch (erro) {
    console.log('Erro ao buscar imagem do artigo:', erro.message);
    return null;
  }
}

async function baixarImagemBase64(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: new URL(url).origin },
    });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch (erro) {
    console.log('Erro ao baixar imagem:', erro.message);
    return null;
  }
}

module.exports = { extrairImagemOg, buscarImagemArtigo, baixarImagemBase64 };
