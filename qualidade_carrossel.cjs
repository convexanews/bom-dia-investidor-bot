// Portão editorial para carrosséis de notícia. O objetivo é reter pela clareza
// e pela consequência concreta — nunca por exagero ou medo fabricado.
const { normalizar } = require('./qualidade_editorial.cjs');

const FRASES_PROIBIDAS = [
  'garantido', 'sem risco', 'compre agora', 'ultima chance', 'vai explodir',
  'fique rico', 'lucro certo', 'dobrar seu dinheiro',
];

function temDadoConcreto(texto) {
  return /\d|r\$|us\$|%|pontos|bilh(?:ao|ões)|milh(?:ao|ões)/i.test(String(texto || ''));
}

function avaliarCarrossel({ manchete, resumo, fonte, peso = 0, slides = [], impacto }) {
  const titulo = String(manchete || '').trim();
  const contexto = String(resumo || '').trim();
  const textoCompleto = normalizar(`${titulo} ${contexto}`);
  const bloqueios = [];
  if (peso < 80) bloqueios.push('impacto editorial abaixo do mínimo para carrossel de notícia');
  if (titulo.length < 28 || titulo.length > 115) bloqueios.push('gancho fora do tamanho de leitura rápida');
  if (contexto.length < 110) bloqueios.push('contexto insuficiente para sustentar a narrativa');
  if (!String(fonte || '').trim()) bloqueios.push('fonte não informada');
  if (FRASES_PROIBIDAS.some(frase => textoCompleto.includes(frase))) bloqueios.push('linguagem promocional ou promessa financeira');

  const pontos = {
    impacto: peso >= 90 ? 25 : peso >= 80 ? 20 : 0,
    prova: (temDadoConcreto(`${titulo} ${contexto}`) ? 15 : 5) + (fonte ? 10 : 0),
    gancho: titulo.length >= 28 && titulo.length <= 90 ? 15 : 5,
    narrativa: slides.length >= 4 && slides.length <= 6 ? 20 : 5,
    consequencia: /investidor|mercado|juros|ações|acao|renda fixa|bolsa|crédito|credito|carteira/i.test(`${contexto} ${impacto || ''}`) ? 10 : 0,
  };
  const nota = Object.values(pontos).reduce((total, valor) => total + valor, 0);
  return {
    aprovada: bloqueios.length === 0 && nota >= 75,
    nota,
    pontos,
    bloqueios,
    recomendacao: bloqueios.length
      ? 'Reescreva a pauta com um fato verificável, fonte e consequência clara para o investidor.'
      : 'Aprovado: mantenha um dado por slide e uma virada narrativa entre os slides.',
  };
}

function montarNarrativaImpacto({ manchete, resumo, categoria, sentimento, apoioCapa }) {
  const frases = String(resumo || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const fato = (frases[0] || manchete || '').trim();
  const causa = (frases[1] || 'O mercado ainda acompanha os dados que podem confirmar esse movimento.').trim();
  const impacto = apoioCapa || `O efeito para ${categoria || 'o investidor'} depende dos próximos dados e da reação do mercado.`;
  const tema = sentimento === 'positivo' ? 'positivo' : sentimento === 'negativo' ? 'negativo' : 'neutro';
  return [
    { kicker: 'O que mudou agora', texto: fato, destaque: 'O FATO CENTRAL', tema },
    { kicker: 'O dado por trás', texto: causa, destaque: 'O CONTEXTO', tema },
    { kicker: 'Por que importa', texto: impacto, destaque: 'PARA O INVESTIDOR', tema },
    { kicker: 'O próximo sinal', texto: 'Acompanhe a fonte, os próximos dados e a reação do mercado antes de tomar qualquer decisão.', destaque: 'O QUE OBSERVAR', tema },
  ];
}

module.exports = { avaliarCarrossel, montarNarrativaImpacto, temDadoConcreto, FRASES_PROIBIDAS };
