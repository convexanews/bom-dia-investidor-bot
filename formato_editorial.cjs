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

function contextoPorCategoria(categoria) {
  const textos = {
    economia: 'Juros, inflação e os próximos dados econômicos entram no radar.',
    mercados: 'A reação do mercado pode alterar a leitura do cenário.',
    empresas: 'Resultados, projeções e comunicados da empresa merecem atenção.',
    bolsa: 'Volume, preço e os próximos pregões ajudam a confirmar o movimento.',
    renda_fixa: 'Taxas e expectativas para juros podem influenciar os títulos.',
  };
  return textos[limparTexto(categoria).toLowerCase()] || 'Os próximos dados ajudam a colocar a notícia em perspectiva.';
}

// Capa + oito etapas + CTA final: sempre dez imagens, sem inventar fatos.
function montarRoteiroCarrossel({ manchete, resumo, categoria, sentimento, apoioCapa }) {
  const fatos = dividirResumoCurto(resumo, 3, 125);
  const fatoPrincipal = fatos[0] || limitarTexto(manchete, 125);
  const fatoComplementar = fatos.slice(1).join(' ') || 'Acompanhe a fonte e os próximos desdobramentos da notícia.';
  const contexto = contextoPorCategoria(categoria);
  const impacto = {
    positivo: 'Movimentos positivos precisam de confirmação nos próximos dados.',
    negativo: 'Movimentos negativos pedem atenção, sem decisões por impulso.',
  }[sentimento] || 'Uma notícia isolada não substitui a análise do cenário completo.';
  const tema = sentimento === 'positivo' ? 'positivo' : sentimento === 'negativo' ? 'negativo' : 'neutro';

  return [
    { kicker: 'O fato em uma frase', texto: fatoPrincipal, destaque: 'O ponto central', tema },
    { kicker: 'O que aconteceu', texto: fatoComplementar, destaque: 'O contexto', tema },
    { kicker: 'Por que entrou no radar', texto: apoioCapa || contexto, destaque: 'Por que importa', tema },
    { kicker: 'Quem deve observar', texto: contexto, destaque: 'Para o investidor', tema },
    { kicker: 'O que isso pode mudar', texto: impacto, destaque: 'Sem impulso', tema },
    { kicker: 'O que observar agora', texto: 'Dados, comunicados oficiais e a reação do mercado nos próximos dias.', destaque: 'Próximos sinais', tema },
    { kicker: 'Antes de decidir', texto: 'Compare a informação com a fonte original e com a sua estratégia de investimento.', destaque: 'Olhe o todo', tema },
    { kicker: 'Resumo final', texto: limitarTexto(manchete, 150), destaque: 'Acompanhe', tema },
  ];
}

module.exports = { criarCapaRetencao, dividirResumoCurto, montarRoteiroReel, quebrarLegendas, limitarTexto, montarRoteiroCarrossel };
