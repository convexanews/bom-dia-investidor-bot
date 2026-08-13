// Freio de segurança editorial: evita insistir em automação quando o público
// não está recebendo o conteúdo. Só age com métricas maduras e disponíveis.
function alcanceBaixoConsecutivo(registros, { minimoAlcance = 25, minimoPosts = 3 } = {}) {
  const maduros = registros
    .filter(r => Number.isFinite(Number(r?.insights?.reach)))
    .filter(r => r.dataPostagem && Date.now() - new Date(r.dataPostagem).getTime() >= 72 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.dataPostagem) - new Date(a.dataPostagem));
  const recentes = maduros.slice(0, minimoPosts);
  return recentes.length === minimoPosts && recentes.every(r => Number(r.insights.reach) < minimoAlcance);
}

function avaliarDesempenhoRecente(registros) {
  if (!alcanceBaixoConsecutivo(registros)) return { aprovado: true };
  return {
    aprovado: false,
    motivo: 'três posts maduros consecutivos ficaram abaixo do piso de alcance; pausar automação e revisar pauta, capa e CTA',
  };
}

module.exports = { alcanceBaixoConsecutivo, avaliarDesempenhoRecente };
