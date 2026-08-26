// Localiza imagens editoriais sem depender de hotlink direto no navegador.
// O Studio usa buscarConteudoArtigo() e depois entrega a mídia pelo proxy local.

const ARTICLE_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.7',
};

function decode(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function attr(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decode(match[2].trim()) : '';
}

function absolutizar(value, baseUrl) {
  const clean = decode(value).trim();
  if (!clean || /^(?:data|blob|javascript):/i.test(clean)) return null;
  try {
    const result = new URL(clean, baseUrl);
    return /^https?:$/.test(result.protocol) ? result.href : null;
  } catch { return null; }
}

function extrairImagemOg(html) {
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const key = (attr(tag, 'property') || attr(tag, 'name')).toLowerCase();
    if (key === 'og:image' || key === 'og:image:url') return attr(tag, 'content') || null;
  }
  return null;
}

function imagensJsonLd(value, output = []) {
  if (!value) return output;
  if (Array.isArray(value)) { value.forEach(item => imagensJsonLd(item, output)); return output; }
  if (typeof value !== 'object') return output;
  for (const [key, item] of Object.entries(value)) {
    if (/^(image|thumbnailUrl|contentUrl)$/i.test(key)) {
      if (typeof item === 'string') output.push(item);
      else if (item && typeof item.url === 'string') output.push(item.url);
      if (typeof item === 'object') imagensJsonLd(item, output);
    } else if (typeof item === 'object') imagensJsonLd(item, output);
  }
  return output;
}

function extrairImagensArtigo(html, baseUrl) {
  const texto = String(html || '');
  const candidates = [];
  for (const tag of texto.match(/<meta\b[^>]*>/gi) || []) {
    const key = (attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop')).toLowerCase();
    if (/^(?:og:image(?::url)?|twitter:image(?::src)?|image|thumbnailurl)$/.test(key)) candidates.push(attr(tag, 'content'));
  }
  for (const tag of texto.match(/<link\b[^>]*>/gi) || []) {
    if ((attr(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('image_src')) candidates.push(attr(tag, 'href'));
  }
  for (const block of texto.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { imagensJsonLd(JSON.parse(block[1]), candidates); } catch {}
  }
  // Último recurso para páginas sem metadados sociais. data-src evita placeholders lazy-load.
  for (const tag of texto.match(/<img\b[^>]*>/gi) || []) {
    candidates.push(attr(tag, 'data-src'), attr(tag, 'data-lazy-src'), attr(tag, 'src'));
    const srcset = attr(tag, 'data-srcset') || attr(tag, 'srcset');
    if (srcset) candidates.push(...srcset.split(',').map(part => part.trim().split(/\s+/)[0]).reverse());
  }
  const result = [];
  for (const candidate of candidates) {
    const url = absolutizar(candidate, baseUrl);
    if (!url || result.includes(url)) continue;
    if (/(?:sprite|favicon|\/logo[-_.\/]|avatar|placeholder|tracking|pixel)/i.test(url)) continue;
    result.push(url);
    if (result.length >= 20) break;
  }
  return result;
}

function htmlParaTexto(value) {
  return decode(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function articleBodiesJsonLd(value, output = []) {
  if (!value) return output;
  if (Array.isArray(value)) { value.forEach(item => articleBodiesJsonLd(item, output)); return output; }
  if (typeof value !== 'object') return output;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'articleBody' && typeof item === 'string') output.push(item);
    else if (item && typeof item === 'object') articleBodiesJsonLd(item, output);
  }
  return output;
}

function paragrafoEditorial(value) {
  const texto = htmlParaTexto(value)
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (texto.length < 45) return '';
  if (/^(?:leia também|veja também|assista|publicidade|conteúdo publicitário|siga o canal|tem alguma sugestão)/i.test(texto)) return '';
  return texto
    .replace(/\s*Tem alguma sugestão de reportagem\?[\s\S]*?(?=(?:Com o resultado|Em |No |Na |O |A )[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairTextoArtigo(html) {
  const texto = String(html || ''), candidatos = [];
  for (const block of texto.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { articleBodiesJsonLd(JSON.parse(block[1]), candidatos); } catch {}
  }
  for (const block of texto.matchAll(/<p\b[^>]*class=["'][^"']*content-text__container[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi)) candidatos.push(block[1]);
  if (!candidatos.length) {
    const article = (/<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(texto) || [])[1] || '';
    for (const block of article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) candidatos.push(block[1]);
  }
  const paragrafos = [];
  for (const candidato of candidatos) {
    const paragrafo = paragrafoEditorial(candidato);
    if (!paragrafo || paragrafos.includes(paragrafo)) continue;
    paragrafos.push(paragrafo);
    if (paragrafos.join(' ').length >= 8000) break;
  }
  return paragrafos.join('\n\n');
}

function dividirEmBlocosEditoriais(texto, maximo = 260, quantidade = 4) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpo) return [];
  let frases;
  try { frases = [...new Intl.Segmenter('pt-BR', { granularity: 'sentence' }).segment(limpo)].map(item => item.segment.trim()).filter(Boolean); }
  catch { frases = limpo.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(item => item.trim()).filter(Boolean) || [limpo]; }
  const blocos = [];
  for (const frase of frases) {
    if (blocos.length >= quantidade) break;
    const atual = blocos[blocos.length - 1] || '';
    if (atual && `${atual} ${frase}`.length <= maximo) blocos[blocos.length - 1] = `${atual} ${frase}`;
    else if (frase.length <= maximo) blocos.push(frase);
    else {
      const partes = frase.split(/(?<=[,;:])\s+/);
      for (const parte of partes) {
        if (blocos.length >= quantidade) break;
        const anterior = blocos[blocos.length - 1] || '';
        if (anterior && `${anterior} ${parte}`.length <= maximo) blocos[blocos.length - 1] = `${anterior} ${parte}`;
        else blocos.push(parte.length <= maximo ? parte : `${parte.slice(0, maximo - 1).replace(/\s+\S*$/, '')}…`);
      }
    }
  }
  return blocos;
}

async function buscarConteudoArtigo(link) {
  if (!/^https?:\/\//i.test(String(link || ''))) return { imagens: [] };
  const response = await fetch(link, { headers: ARTICLE_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`A matéria respondeu HTTP ${response.status}`);
  const contentType = String(response.headers.get('content-type') || '');
  if (contentType && !/html|xhtml/i.test(contentType)) throw new Error('A matéria não retornou HTML');
  const html = await response.text();
  if (html.length > 6 * 1024 * 1024) throw new Error('A página da matéria é muito grande');
  const texto = extrairTextoArtigo(html);
  return { imagens: extrairImagensArtigo(html, response.url || link), texto, blocos: dividirEmBlocosEditoriais(texto) };
}

async function buscarImagemArtigo(link) {
  try { return (await buscarConteudoArtigo(link)).imagens[0] || null; }
  catch (erro) { console.log('Erro ao buscar imagem do artigo:', erro.message); return null; }
}

async function baixarImagemBase64(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { headers: { ...ARTICLE_HEADERS, accept: 'image/avif,image/webp,image/*,*/*;q=0.8', referer: new URL(url).origin }, signal: AbortSignal.timeout(20000) });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length || buf.length > 12 * 1024 * 1024) return null;
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch (erro) { console.log('Erro ao baixar imagem:', erro.message); return null; }
}

module.exports = { extrairImagemOg, extrairImagensArtigo, extrairTextoArtigo, dividirEmBlocosEditoriais, buscarConteudoArtigo, buscarImagemArtigo, baixarImagemBase64 };
