// Banco de ~100 ideias de stories interativos (enquetes) para postagem manual o ano todo.
// Usado pelo gerador (gerar_painel_storys.cjs) e pela rotação diária automática (auto-story-enquete.cjs).
module.exports = [
  // ── Ações ──
  { slug: 'acoes-gosta', icone: '📊', pergunta: 'Você gosta de investir em ações?', iconeA: '✅', opcaoA: 'Sim, adoro!', iconeB: '😐', opcaoB: 'Ainda tenho medo' },
  { slug: 'ibov-semana', icone: '📈', pergunta: 'Ibovespa vai subir ou cair essa semana?', iconeA: '🟢', opcaoA: 'Vai SUBIR', iconeB: '🔴', opcaoB: 'Vai CAIR' },
  { slug: 'acoes-blue-chips', icone: '🏆', pergunta: 'Você prefere blue chips ou small caps?', iconeA: '🛡️', opcaoA: 'Blue chips', iconeB: '🚀', opcaoB: 'Small caps' },
  { slug: 'acoes-quantas', icone: '🔢', pergunta: 'Quantas ações diferentes você tem na carteira?', iconeA: '📦', opcaoA: 'Até 10', iconeB: '🗂️', opcaoB: 'Mais de 10' },
  { slug: 'acoes-setor-favorito', icone: '🏭', pergunta: 'Qual setor você mais investe?', iconeA: '🏦', opcaoA: 'Bancos/Financeiro', iconeB: '⚡', opcaoB: 'Energia/Commodities' },
  { slug: 'acoes-day-trade', icone: '⚡', pergunta: 'Você já tentou day trade?', iconeA: '✅', opcaoA: 'Sim, já tentei', iconeB: '❌', opcaoB: 'Nunca, prefiro longo prazo' },
  { slug: 'acoes-balanco', icone: '📑', pergunta: 'Você lê o balanço das empresas antes de investir?', iconeA: '✅', opcaoA: 'Sim, sempre', iconeB: '🤷', opcaoB: 'Confesso que não' },
  { slug: 'acoes-internacional', icone: '🌎', pergunta: 'Você investe em ações no exterior (EUA etc)?', iconeA: '✅', opcaoA: 'Sim, tenho lá fora', iconeB: '🇧🇷', opcaoB: 'Só no Brasil' },
  { slug: 'acoes-bancos-vs-varejo', icone: '🛒', pergunta: 'O que rende mais na sua opinião: Bancos ou Varejo?', iconeA: '🏦', opcaoA: 'Bancos', iconeB: '🛍️', opcaoB: 'Varejo' },
  { slug: 'acoes-ipo', icone: '🆕', pergunta: 'Você já investiu em algum IPO (ação nova na bolsa)?', iconeA: '✅', opcaoA: 'Sim, já investi', iconeB: '❌', opcaoB: 'Nunca participei' },

  // ── Renda Fixa & Tesouro ──
  { slug: 'renda-fixa-variavel', icone: '🏦', pergunta: 'Você prefere renda fixa ou renda variável?', iconeA: '🔒', opcaoA: 'Renda Fixa', iconeB: '📊', opcaoB: 'Renda Variável' },
  { slug: 'selic-vai-cair', icone: '🏛️', pergunta: 'Você acha que a Selic vai cair na próxima reunião?', iconeA: '📉', opcaoA: 'Sim, vai cair', iconeB: '➡️', opcaoB: 'Vai ficar igual' },
  { slug: 'tesouro-direto', icone: '📜', pergunta: 'Você já investe no Tesouro Direto?', iconeA: '✅', opcaoA: 'Sim, já tenho', iconeB: '❌', opcaoB: 'Ainda não' },
  { slug: 'cdb-lci-lca', icone: '🧾', pergunta: 'Você prefere CDB ou LCI/LCA?', iconeA: '💼', opcaoA: 'CDB', iconeB: '🏠', opcaoB: 'LCI/LCA (isento de IR)' },
  { slug: 'tesouro-prefixado-vs-selic', icone: '⚖️', pergunta: 'Tesouro Prefixado ou Tesouro Selic?', iconeA: '📌', opcaoA: 'Prefixado', iconeB: '🔄', opcaoB: 'Selic' },
  { slug: 'renda-fixa-protecao', icone: '🛡️', pergunta: 'Você usa renda fixa como proteção da carteira?', iconeA: '✅', opcaoA: 'Sim, sempre tenho uma reserva', iconeB: '❌', opcaoB: 'Vou tudo pra renda variável' },
  { slug: 'cdi-rendimento', icone: '📈', pergunta: 'Você sabe quanto rende 100% do CDI hoje?', iconeA: '✅', opcaoA: 'Sim, acompanho', iconeB: '🤔', opcaoB: 'Não tenho ideia' },
  { slug: 'tesouro-ipca', icone: '🛡️', pergunta: 'Você investe no Tesouro IPCA+ pra proteger da inflação?', iconeA: '✅', opcaoA: 'Sim, é minha reserva', iconeB: '❌', opcaoB: 'Ainda não conheço bem' },
  { slug: 'previdencia-privada', icone: '👴', pergunta: 'Você tem previdência privada (PGBL/VGBL)?', iconeA: '✅', opcaoA: 'Sim, já tenho', iconeB: '❌', opcaoB: 'Não, ainda não' },
  { slug: 'inflacao-medo', icone: '📉', pergunta: 'A inflação te preocupa nos seus investimentos?', iconeA: '😟', opcaoA: 'Sim, bastante', iconeB: '😌', opcaoB: 'Não, já me protejo' },

  // ── Criptomoedas ──
  { slug: 'tem-cripto', icone: '₿', pergunta: 'Você tem Bitcoin ou criptomoedas na carteira?', iconeA: '✅', opcaoA: 'Sim, tenho cripto', iconeB: '❌', opcaoB: 'Não, prefiro evitar' },
  { slug: 'bitcoin-vai-subir', icone: '🚀', pergunta: 'O Bitcoin vai subir nos próximos 30 dias?', iconeA: '📈', opcaoA: 'Sim, vai subir', iconeB: '📉', opcaoB: 'Vai cair' },
  { slug: 'cripto-altcoins', icone: '🪙', pergunta: 'Você só tem Bitcoin ou também altcoins?', iconeA: '₿', opcaoA: 'Só Bitcoin', iconeB: '🌈', opcaoB: 'Tenho altcoins também' },
  { slug: 'cripto-medo', icone: '😰', pergunta: 'Criptomoeda ainda te dá medo de investir?', iconeA: '😨', opcaoA: 'Sim, ainda tenho receio', iconeB: '😎', opcaoB: 'Não, já estou tranquilo' },
  { slug: 'cripto-porcentagem', icone: '📊', pergunta: 'Quanto da sua carteira é cripto?', iconeA: '🔹', opcaoA: 'Menos de 10%', iconeB: '🔶', opcaoB: 'Mais de 10%' },
  { slug: 'ethereum-vs-bitcoin', icone: '⚔️', pergunta: 'Você prefere Bitcoin ou Ethereum?', iconeA: '₿', opcaoA: 'Bitcoin', iconeB: 'Ξ', opcaoB: 'Ethereum' },
  { slug: 'cripto-exchange', icone: '🏪', pergunta: 'Você guarda cripto na exchange ou em carteira própria?', iconeA: '🏪', opcaoA: 'Na exchange', iconeB: '🔐', opcaoB: 'Carteira própria (cold wallet)' },
  { slug: 'cripto-etf', icone: '📦', pergunta: 'Você prefere comprar cripto direto ou via ETF?', iconeA: '₿', opcaoA: 'Cripto direto', iconeB: '📦', opcaoB: 'ETF de cripto' },
  { slug: 'stablecoin-usa', icone: '💲', pergunta: 'Você já usou stablecoin (USDT/USDC)?', iconeA: '✅', opcaoA: 'Sim, já usei', iconeB: '❌', opcaoB: 'Nunca usei' },
  { slug: 'cripto-halving', icone: '⏳', pergunta: 'Você acompanha o ciclo do Bitcoin (halving)?', iconeA: '✅', opcaoA: 'Sim, acompanho de perto', iconeB: '🤷', opcaoB: 'Não sabia que existia' },

  // ── Fundos Imobiliários ──
  { slug: 'tem-fii', icone: '🏢', pergunta: 'Você já investe em Fundos Imobiliários (FIIs)?', iconeA: '✅', opcaoA: 'Sim, adoro FIIs!', iconeB: '🤔', opcaoB: 'Ainda não comecei' },
  { slug: 'fii-tijolo-papel', icone: '🧱', pergunta: 'Você prefere FII de tijolo ou de papel?', iconeA: '🧱', opcaoA: 'Tijolo (imóveis)', iconeB: '📄', opcaoB: 'Papel (recebíveis/CRI)' },
  { slug: 'fii-dividendo-mensal', icone: '💰', pergunta: 'Você vive ou complementa a renda com dividendos de FII?', iconeA: '✅', opcaoA: 'Sim, já complemento', iconeB: '⏳', opcaoB: 'Ainda estou construindo' },
  { slug: 'fii-shopping-galpao', icone: '🏬', pergunta: 'Você prefere FII de shopping ou de galpão logístico?', iconeA: '🏬', opcaoA: 'Shopping', iconeB: '📦', opcaoB: 'Galpão logístico' },
  { slug: 'fii-quantos', icone: '🔢', pergunta: 'Quantos FIIs diferentes você tem?', iconeA: '📦', opcaoA: 'Até 5', iconeB: '🗂️', opcaoB: 'Mais de 5' },
  { slug: 'fof-vs-fii', icone: '🧮', pergunta: 'Você prefere FII direto ou Fundo de Fundos (FOF)?', iconeA: '🏢', opcaoA: 'FII direto', iconeB: '🧮', opcaoB: 'Fundo de Fundos' },
  { slug: 'fii-vacancia', icone: '🔑', pergunta: 'Você verifica a vacância antes de comprar um FII?', iconeA: '✅', opcaoA: 'Sim, sempre confiro', iconeB: '🤷', opcaoB: 'Nunca prestei atenção' },

  // ── Câmbio / Dólar ──
  { slug: 'dolar-hoje', icone: '💵', pergunta: 'O Dólar vai fechar acima de R$ 5,80 hoje?', iconeA: '📈', opcaoA: 'Sim, vai subir', iconeB: '📉', opcaoB: 'Não, vai cair' },
  { slug: 'dolar-protecao', icone: '🛡️', pergunta: 'Você guarda dólar como proteção (hedge)?', iconeA: '✅', opcaoA: 'Sim, tenho parte em dólar', iconeB: '❌', opcaoB: 'Não, fico só em real' },
  { slug: 'dolar-viagem-investimento', icone: '✈️', pergunta: 'Você compra dólar pra viagem ou como investimento?', iconeA: '✈️', opcaoA: 'Pra viajar', iconeB: '📈', opcaoB: 'Como investimento' },
  { slug: 'euro-ou-dolar', icone: '💶', pergunta: 'Se fosse guardar em moeda forte, qual escolheria?', iconeA: '💵', opcaoA: 'Dólar', iconeB: '💶', opcaoB: 'Euro' },
  { slug: 'ouro-protecao', icone: '🥇', pergunta: 'Você investe em ouro como proteção?', iconeA: '✅', opcaoA: 'Sim, tenho ouro', iconeB: '❌', opcaoB: 'Não, ainda não' },

  // ── Planejamento financeiro / orçamento ──
  { slug: 'investir-salario', icone: '💰', pergunta: 'Você vai investir parte do salário esse mês?', iconeA: '✅', opcaoA: 'Sim, com certeza!', iconeB: '😅', opcaoB: 'Tá difícil esse mês' },
  { slug: 'investe-toda-semana', icone: '📆', pergunta: 'Você investe toda semana, mesmo que pouco?', iconeA: '✅', opcaoA: 'Sim, todo semana!', iconeB: '❌', opcaoB: 'Ainda não consigo' },
  { slug: 'reserva-emergencia', icone: '🛡️', pergunta: 'Você já tem reserva de emergência montada?', iconeA: '✅', opcaoA: 'Sim, já tenho', iconeB: '⏳', opcaoB: 'Ainda estou montando' },
  { slug: 'planilha-gastos', icone: '📋', pergunta: 'Você controla seus gastos em planilha ou app?', iconeA: '✅', opcaoA: 'Sim, controlo tudo', iconeB: '🙈', opcaoB: 'Confesso que não' },
  { slug: 'regra-50-30-20', icone: '✂️', pergunta: 'Você conhece e segue a regra 50/30/20?', iconeA: '✅', opcaoA: 'Sim, sigo direitinho', iconeB: '❓', opcaoB: 'Nunca tinha ouvido falar' },
  { slug: 'divida-cartao', icone: '💳', pergunta: 'Você está com alguma dívida no cartão de crédito hoje?', iconeA: '😟', opcaoA: 'Sim, infelizmente', iconeB: '✅', opcaoB: 'Não, estou no azul' },
  { slug: 'meta-financeira-ano', icone: '🎯', pergunta: 'Você tem uma meta financeira definida pra esse ano?', iconeA: '✅', opcaoA: 'Sim, já tenho!', iconeB: '📝', opcaoB: 'Ainda vou definir' },
  { slug: 'percentual-renda-investido', icone: '📐', pergunta: 'Quanto da sua renda você investe por mês?', iconeA: '🔹', opcaoA: 'Até 10%', iconeB: '🔶', opcaoB: 'Mais de 10%' },
  { slug: 'orcamento-13-salario', icone: '🎁', pergunta: 'Você já planejou o que fazer com o 13º salário?', iconeA: '✅', opcaoA: 'Sim, já tenho plano', iconeB: '🤔', opcaoB: 'Ainda não pensei' },
  { slug: 'gasto-impulsivo', icone: '🛍️', pergunta: 'Você já se arrependeu de uma compra por impulso esse mês?', iconeA: '😅', opcaoA: 'Sim, confesso', iconeB: '✅', opcaoB: 'Não, me controlei' },

  // ── Hábitos de investidor ──
  { slug: 'comecou-investir', icone: '🌱', pergunta: 'Você já começou a investir ou ainda só estuda?', iconeA: '✅', opcaoA: 'Já investo', iconeB: '📚', opcaoB: 'Ainda estudando' },
  { slug: 'acompanha-diario', icone: '👀', pergunta: 'Você acompanha o mercado todos os dias?', iconeA: '✅', opcaoA: 'Sim, todo dia!', iconeB: '🗓️', opcaoB: 'Só de vez em quando' },
  { slug: 'app-investimento', icone: '📱', pergunta: 'Você investe direto pelo celular?', iconeA: '✅', opcaoA: 'Sim, tudo pelo app', iconeB: '💻', opcaoB: 'Prefiro o computador' },
  { slug: 'corretora-unica', icone: '🏦', pergunta: 'Você usa uma corretora só ou várias?', iconeA: '1️⃣', opcaoA: 'Uma corretora só', iconeB: '🔢', opcaoB: 'Tenho conta em várias' },
  { slug: 'investidor-ha-quanto-tempo', icone: '⏱️', pergunta: 'Há quanto tempo você investe?', iconeA: '🌱', opcaoA: 'Menos de 1 ano', iconeB: '🌳', opcaoB: 'Mais de 1 ano' },
  { slug: 'le-relatorios', icone: '📰', pergunta: 'Você lê relatórios e notícias do mercado antes de decidir?', iconeA: '✅', opcaoA: 'Sim, sempre pesquiso', iconeB: '🎲', opcaoB: 'Às vezes vou no feeling' },
  { slug: 'aporte-automatico', icone: '🔁', pergunta: 'Você já configurou aporte automático mensal?', iconeA: '✅', opcaoA: 'Sim, já automatizei', iconeB: '✋', opcaoB: 'Ainda faço manual' },
  { slug: 'estuda-mercado-financeiro', icone: '🎓', pergunta: 'Você estuda sobre mercado financeiro com frequência?', iconeA: '✅', opcaoA: 'Sim, todo dia aprendo algo', iconeB: '📅', opcaoB: 'De vez em quando' },
  { slug: 'compartilha-conhecimento', icone: '🗣️', pergunta: 'Você já indicou o Bom Dia Investidor pra um amigo?', iconeA: '✅', opcaoA: 'Sim, já indiquei!', iconeB: '📤', opcaoB: 'Ainda não, mas vou indicar' },
  { slug: 'segue-influenciador', icone: '📺', pergunta: 'Você segue algum especialista de finanças nas redes?', iconeA: '✅', opcaoA: 'Sim, sigo vários', iconeB: '❌', opcaoB: 'Não sigo ninguém' },

  // ── Aposentadoria / longo prazo ──
  { slug: 'objetivo-investir', icone: '🎯', pergunta: 'Qual seu maior objetivo investindo?', iconeA: '🏠', opcaoA: 'Comprar um imóvel', iconeB: '🏖️', opcaoB: 'Aposentadoria/liberdade' },
  { slug: 'aposentadoria-inss', icone: '👴', pergunta: 'Você confia só no INSS pra sua aposentadoria?', iconeA: '😟', opcaoA: 'Sim, só conto com isso', iconeB: '✅', opcaoB: 'Não, já me planejo por conta' },
  { slug: 'independencia-financeira-idade', icone: '🕐', pergunta: 'Com que idade você quer alcançar a independência financeira?', iconeA: '🚀', opcaoA: 'Antes dos 50', iconeB: '⏳', opcaoB: 'Depois dos 50' },
  { slug: 'filhos-educacao-financeira', icone: '👨‍👩‍👧', pergunta: 'Você já ensina educação financeira pros seus filhos?', iconeA: '✅', opcaoA: 'Sim, já ensino', iconeB: '🤔', opcaoB: 'Ainda não, mas quero' },
  { slug: 'imovel-proprio', icone: '🏠', pergunta: 'Você prioriza comprar imóvel próprio ou investir o dinheiro?', iconeA: '🏠', opcaoA: 'Comprar imóvel', iconeB: '📈', opcaoB: 'Investir e alugar' },
  { slug: 'herança-planejamento', icone: '📜', pergunta: 'Você já pensou em planejamento sucessório (herança)?', iconeA: '✅', opcaoA: 'Sim, já penso nisso', iconeB: '❌', opcaoB: 'Ainda não pensei' },
  { slug: 'aposentar-quanto-patrimonio', icone: '💼', pergunta: 'Você sabe quanto de patrimônio precisa pra se aposentar?', iconeA: '✅', opcaoA: 'Sim, já calculei', iconeB: '🤷', opcaoB: 'Não tenho ideia ainda' },

  // ── Educação financeira geral ──
  { slug: 'dividendos-vs-valorizacao', icone: '💸', pergunta: 'O que você mais busca: dividendos ou valorização?', iconeA: '💰', opcaoA: 'Dividendos', iconeB: '📈', opcaoB: 'Valorização' },
  { slug: 'juros-compostos', icone: '🧮', pergunta: 'Você já calculou o efeito dos juros compostos na sua carteira?', iconeA: '✅', opcaoA: 'Sim, já simulei', iconeB: '❌', opcaoB: 'Nunca calculei' },
  { slug: 'diversificacao', icone: '🧩', pergunta: 'Sua carteira é bem diversificada hoje?', iconeA: '✅', opcaoA: 'Sim, bem diversificada', iconeB: '⚠️', opcaoB: 'Concentrada em poucos ativos' },
  { slug: 'perfil-investidor', icone: '🧭', pergunta: 'Qual seu perfil de investidor?', iconeA: '🛡️', opcaoA: 'Conservador', iconeB: '🚀', opcaoB: 'Arrojado' },
  { slug: 'imposto-renda-investimentos', icone: '🧾', pergunta: 'Você sabe declarar seus investimentos no Imposto de Renda?', iconeA: '✅', opcaoA: 'Sim, já domino', iconeB: '😵', opcaoB: 'Confesso que tenho dúvidas' },
  { slug: 'livro-financas', icone: '📖', pergunta: 'Você já leu algum livro sobre finanças esse ano?', iconeA: '✅', opcaoA: 'Sim, já li!', iconeB: '📚', opcaoB: 'Ainda não, mas quero' },
  { slug: 'curso-investimentos', icone: '🎓', pergunta: 'Você já fez algum curso de investimentos?', iconeA: '✅', opcaoA: 'Sim, já fiz', iconeB: '❌', opcaoB: 'Nunca fiz' },
  { slug: 'erro-investindo', icone: '🙊', pergunta: 'Você já cometeu algum erro grande investindo?', iconeA: '😅', opcaoA: 'Sim, já aprendi na prática', iconeB: '🍀', opcaoB: 'Ainda não tive nenhum' },
  { slug: 'liquidez-importancia', icone: '💧', pergunta: 'Liquidez é importante pra você na hora de escolher investimento?', iconeA: '✅', opcaoA: 'Sim, é essencial', iconeB: '⏳', opcaoB: 'Não me importo de esperar' },
  { slug: 'planejamento-vs-improviso', icone: '🗺️', pergunta: 'Suas decisões financeiras são planejadas ou no improviso?', iconeA: '🗺️', opcaoA: 'Planejadas', iconeB: '🎲', opcaoB: 'No improviso mesmo' },

  // ── Curiosidades / mercado ──
  { slug: 'cenario-economico-otimista', icone: '🔮', pergunta: 'Você está otimista com a economia brasileira pros próximos meses?', iconeA: '😊', opcaoA: 'Sim, otimista', iconeB: '😬', opcaoB: 'Não, preocupado' },
  { slug: 'maior-risco-2026', icone: '⚠️', pergunta: 'Qual você acha o maior risco pro mercado esse ano?', iconeA: '🌍', opcaoA: 'Cenário externo/EUA', iconeB: '🏛️', opcaoB: 'Política interna' },
  { slug: 'eleicoes-mercado', icone: '🗳️', pergunta: 'Eleições afetam suas decisões de investimento?', iconeA: '✅', opcaoA: 'Sim, fico mais cauteloso', iconeB: '❌', opcaoB: 'Não, sigo minha estratégia' },
  { slug: 'taxa-juros-eua', icone: '🇺🇸', pergunta: 'Você acompanha as decisões do FED (juros nos EUA)?', iconeA: '✅', opcaoA: 'Sim, acompanho de perto', iconeB: '🤷', opcaoB: 'Não costumo acompanhar' },
  { slug: 'recessao-medo', icone: '📉', pergunta: 'Você tem medo de uma recessão nos próximos anos?', iconeA: '😟', opcaoA: 'Sim, me preocupa', iconeB: '😌', opcaoB: 'Não, sigo investindo normal' },
  { slug: 'ia-mercado-financeiro', icone: '🤖', pergunta: 'Você usa inteligência artificial pra te ajudar a investir?', iconeA: '✅', opcaoA: 'Sim, já uso', iconeB: '❌', opcaoB: 'Ainda não uso' },
  { slug: 'commodities-brasil', icone: '🌾', pergunta: 'Você investe em ações ligadas a commodities (Vale, Petrobras etc)?', iconeA: '✅', opcaoA: 'Sim, tenho na carteira', iconeB: '❌', opcaoB: 'Não tenho' },
  { slug: 'mercado-aberto-hoje', icone: '🔔', pergunta: 'Você sabia que a B3 funciona das 10h às 17h?', iconeA: '✅', opcaoA: 'Sim, eu sabia', iconeB: '😲', opcaoB: 'Não sabia!' },
  { slug: 'volatilidade-gosta', icone: '🎢', pergunta: 'Você gosta ou odeia dias de muita volatilidade?', iconeA: '🎢', opcaoA: 'Gosto, dá oportunidade', iconeB: '😵', opcaoB: 'Odeio, prefiro calmaria' },
  { slug: 'b3-quer-aprender', icone: '🔔', pergunta: 'Você quer aprender mais sobre como funciona a Bolsa (B3)?', iconeA: '✅', opcaoA: 'Sim, quero aprender!', iconeB: '📚', opcaoB: 'Já sei o suficiente' },
];
