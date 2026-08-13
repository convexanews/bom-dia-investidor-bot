// Barreira final antes de gerar mídia: não permite publicar chamadas truncadas
// ou notícias sem contexto suficiente no feed, Story, carrossel ou Reel.
function limpar(valor) {
  return String(valor || '').replace(/\s+/g, ' ').trim();
}

function validarNoticiaParaPublicacao({ titulo, descricao, fonte }) {
  const manchete = limpar(titulo);
  const resumo = limpar(descricao);

  if (manchete.length < 35) return { aprovada: false, motivo: 'manchete curta demais para explicar o fato' };
  if (manchete.length > 118) return { aprovada: false, motivo: 'manchete longa demais para caber completa no card' };
  if (/(?:\.{3}|…|\[\.\.\.\]|\[â€¦\])\s*$/.test(manchete)) return { aprovada: false, motivo: 'manchete recebida incompleta ou cortada' };
  if (resumo.length < 160) return { aprovada: false, motivo: 'notícia sem contexto suficiente no resumo da fonte' };
  if (/(?:\.{3}|…|\[\.\.\.\]|\[â€¦\])\s*$/.test(resumo)) return { aprovada: false, motivo: 'resumo recebido incompleto ou cortado' };
  if (!limpar(fonte)) return { aprovada: false, motivo: 'fonte não informada' };
  return { aprovada: true, motivo: null };
}

module.exports = { validarNoticiaParaPublicacao };
