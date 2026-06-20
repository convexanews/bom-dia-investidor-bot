// Banco de ideias de stories interativos (enquetes) para postagem manual.
// Usado pelo gerador (gerar_painel_storys.cjs) e pela rotação diária (auto-story-enquete.cjs).
module.exports = [
  { slug: 'acoes-gosta', icone: '📊', pergunta: 'Você gosta de investir em ações?', iconeA: '✅', opcaoA: 'Sim, adoro!', iconeB: '😐', opcaoB: 'Ainda tenho medo' },
  { slug: 'ibov-semana', icone: '📈', pergunta: 'Ibovespa vai subir ou cair essa semana?', iconeA: '🟢', opcaoA: 'Vai SUBIR', iconeB: '🔴', opcaoB: 'Vai CAIR' },
  { slug: 'dolar-hoje', icone: '💵', pergunta: 'O Dólar vai fechar acima de R$ 5,80 hoje?', iconeA: '📈', opcaoA: 'Sim, vai subir', iconeB: '📉', opcaoB: 'Não, vai cair' },
  { slug: 'renda-fixa-variavel', icone: '🏦', pergunta: 'Você prefere renda fixa ou renda variável?', iconeA: '🔒', opcaoA: 'Renda Fixa', iconeB: '📊', opcaoB: 'Renda Variável' },
  { slug: 'tem-cripto', icone: '₿', pergunta: 'Você tem Bitcoin ou criptomoedas na carteira?', iconeA: '✅', opcaoA: 'Sim, tenho cripto', iconeB: '❌', opcaoB: 'Não, prefiro evitar' },
  { slug: 'investir-salario', icone: '💰', pergunta: 'Você vai investir parte do salário esse mês?', iconeA: '✅', opcaoA: 'Sim, com certeza!', iconeB: '😅', opcaoB: 'Tá difícil esse mês' },
  { slug: 'tem-fii', icone: '🏢', pergunta: 'Você já investe em Fundos Imobiliários (FIIs)?', iconeA: '✅', opcaoA: 'Sim, adoro FIIs!', iconeB: '🤔', opcaoB: 'Ainda não comecei' },
  { slug: 'investe-toda-semana', icone: '📆', pergunta: 'Você investe toda semana, mesmo que pouco?', iconeA: '✅', opcaoA: 'Sim, todo semana!', iconeB: '❌', opcaoB: 'Ainda não consigo' },
  { slug: 'objetivo-investir', icone: '🎯', pergunta: 'Qual seu maior objetivo investindo?', iconeA: '🏠', opcaoA: 'Comprar um imóvel', iconeB: '🏖️', opcaoB: 'Aposentadoria/liberdade' },
  { slug: 'comecou-investir', icone: '🌱', pergunta: 'Você já começou a investir ou ainda só estuda?', iconeA: '✅', opcaoA: 'Já investo', iconeB: '📚', opcaoB: 'Ainda estudando' },
  { slug: 'reserva-emergencia', icone: '🛡️', pergunta: 'Você já tem reserva de emergência montada?', iconeA: '✅', opcaoA: 'Sim, já tenho', iconeB: '⏳', opcaoB: 'Ainda estou montando' },
  { slug: 'dividendos-vs-valorizacao', icone: '💸', pergunta: 'O que você mais busca: dividendos ou valorização?', iconeA: '💰', opcaoA: 'Dividendos', iconeB: '📈', opcaoB: 'Valorização' },
  { slug: 'selic-vai-cair', icone: '🏛️', pergunta: 'Você acha que a Selic vai cair na próxima reunião?', iconeA: '📉', opcaoA: 'Sim, vai cair', iconeB: '➡️', opcaoB: 'Vai ficar igual' },
  { slug: 'acompanha-diario', icone: '👀', pergunta: 'Você acompanha o mercado todos os dias?', iconeA: '✅', opcaoA: 'Sim, todo dia!', iconeB: '🗓️', opcaoB: 'Só de vez em quando' },
  { slug: 'app-investimento', icone: '📱', pergunta: 'Você investe direto pelo celular?', iconeA: '✅', opcaoA: 'Sim, tudo pelo app', iconeB: '💻', opcaoB: 'Prefiro o computador' },
  { slug: 'ouro-protecao', icone: '🥇', pergunta: 'Você investe em ouro como proteção?', iconeA: '✅', opcaoA: 'Sim, tenho ouro', iconeB: '❌', opcaoB: 'Não, ainda não' },
];
