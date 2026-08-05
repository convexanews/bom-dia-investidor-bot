// Regras puras de formato: deixam o gancho curto sem inventar fatos.
function limparTexto(valor) {
  return String(valor || '').replace(/\s+/g, ' ').trim();
}

function limitarTexto(valor, limite) {
  const texto = limparTexto(valor);
  if (texto.length <= limite) return texto;
  const corte = texto.slice(0, limite + 1).lastIndexOf(' ');
  return `${texto.slice(0, corte > 20 ? corte : limite).trim()}…`;
}

function criarCapaRetencao(titulo, categoria = 'MERCADO') {
  const texto = limparTexto(titulo).replace(/^\s*(urgente|breaking|alerta)\s*[:\-–]?\s*/i, '');
  const primeiraIdeia = texto.split(/[;:—]/)[0] || texto;
  const gancho = limitarTexto(primeiraIdeia, 72);
  const apoioPorCategoria = {
    economia: 'Entenda o que o mercado observa agora',
    mercados: 'O que pode mudar para o investidor',
    empresas: 'O número e o contexto por trás da notícia',
    bolsa: 'O que acompanhar antes da próxima sessão',
    renda_fixa: 'O que muda para juros e renda fixa',
  };
  return { gancho, apoio: apoioPorCategoria[limparTexto(categoria).toLowerCase()] || 'Entenda o impacto em poucos slides' };
}

function dividirResumoCurto(resumo, maxBlocos = 3, limite = 155) {
  const frases = limparTexto(resumo).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const blocos = [];
  let atual = '';
  for (const frase of frases) {
    const candidata = limparTexto(`${atual} ${frase}`);
    if (atual && candidata.length > limite) {
      blocos.push(limitarTexto(atual, limite));
      atual = frase;
    } else atual = candidata;
  }
  if (atual) blocos.push(limitarTexto(atual, limite));
  return blocos.filter(Boolean).slice(0, maxBlocos);
}

function montarRoteiroReel({ manchete, mancheteVisual, resumo, categoria }) {
  const capa = mancheteVisual || criarCapaRetencao(manchete, categoria).gancho;
  const contexto = dividirResumoCurto(resumo, 2, 145);
  return [capa, ...contexto, 'Siga o Bom Dia Investidor para acompanhar os próximos dados.'].filter(Boolean);
}

function quebrarLegendas(blocos, limite = 54) {
  return blocos.flatMap(bloco => {
    const partes = [];
    let atual = '';
    for (const palavra of limparTexto(bloco).split(' ')) {
      const candidata = limparTexto(`${atual} ${palavra}`);
      if (atual && candidata.length > limite) { partes.push(atual); atual = palavra; } else atual = candidata;
    }
    if (atual) partes.push(atual);
    return partes;
  });
}

module.exports = { criarCapaRetencao, dividirResumoCurto, montarRoteiroReel, quebrarLegendas, limitarTexto };
