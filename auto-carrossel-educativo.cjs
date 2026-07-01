// Gera e publica carrossel educativo semanal às 10h BRT (segunda-feira).
// Cada semana aborda um tema diferente do mercado financeiro.
// Vars necessárias: IG_TOKEN, IG_ACCOUNT_ID, PAGES_TOKEN
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const IG_API_BASE = 'https://graph.instagram.com/v23.0';
const IG_TOKEN = process.env.IG_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

const VERIFICACOES_FILE = path.join(__dirname, 'verificacoes.json');
const PAGES_DIR = path.join(__dirname, 'pages-repo');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const PAGES_RAW_BASE = `https://raw.githubusercontent.com/${PAGES_REPO}/main/bdi-cards`;

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function dataHojeBRT() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// Semana do ano (0-based) para rotacionar temas
function semanaDoAno() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - start) / (7 * 24 * 60 * 60 * 1000));
}

const TEMAS = [
  {
    badge: 'SELIC',
    icone: '🏦',
    titulo: 'O que é a SELIC?',
    subtitulo: 'A taxa mais importante do Brasil',
    slides: [
      { num: '1', titulo: 'O que é a SELIC?', desc: 'É a taxa básica de juros da economia brasileira, definida pelo Banco Central a cada 45 dias.', dica: '<strong>Dica:</strong> Quando a SELIC sobe, renda fixa rende mais. Quando cai, a bolsa tende a subir.' },
      { num: '2', titulo: 'Quem define a SELIC?', desc: 'O COPOM (Comitê de Política Monetária) do Banco Central se reúne 8x por ano para decidir a taxa.', dica: '<strong>Calendário COPOM:</strong> acompanhe as reuniões — elas movimentam todo o mercado!' },
      { num: '3', titulo: 'Por que ela importa?', desc: 'A SELIC influencia preços, emprego, crédito e o rendimento de todos os seus investimentos.', dica: '<strong>Regra:</strong> SELIC alta = inflação controlada + crédito caro. SELIC baixa = consumo aquecido.' },
      { num: '4', titulo: 'SELIC e seus investimentos', desc: 'Tesouro Selic, CDB, LCI e LCA são impactados diretamente. Fundos DI também seguem a taxa.', dica: '<strong>Estratégia:</strong> Em ciclo de alta da SELIC, prefira renda fixa pós-fixada (Tesouro Selic, CDI).' },
      { num: '5', titulo: 'Resumo da SELIC', desc: 'É o termômetro da economia: afeta crédito, consumo, inflação e seus rendimentos mensalmente.', dica: '<strong>Ação prática:</strong> Acompanhe as reuniões do COPOM e ajuste sua carteira conforme o ciclo.' },
    ],
    legenda_extra: 'Entenda a taxa mais importante do Brasil e como ela impacta seus investimentos diariamente.',
    hashtags: '#selic #copom #bancoCentral #rendaFixa #tesouroSelic #educacaoFinanceira',
  },
  {
    badge: 'FIIs',
    icone: '🏢',
    titulo: 'Fundos Imobiliários',
    subtitulo: 'Invista em imóveis sem comprar um',
    slides: [
      { num: '1', titulo: 'O que são FIIs?', desc: 'Fundos de Investimento Imobiliário permitem investir em imóveis (shoppings, galpões, lajes) por R$10 a cota.', dica: '<strong>Vantagem:</strong> Isenção de IR sobre os dividendos para pessoa física — um dos maiores benefícios da renda variável.' },
      { num: '2', titulo: 'Tipos de FIIs', desc: 'Tijolo (imóveis físicos), Papel (CRIs e LCIs) e Fundo de Fundos (FOFs). Cada tipo tem risco e retorno diferentes.', dica: '<strong>Iniciante:</strong> Comece pelos FIIs de tijolo — shoppings e galpões logísticos tendem a ser mais estáveis.' },
      { num: '3', titulo: 'Como ganhar com FIIs?', desc: 'Dividendos mensais (renda passiva) + valorização das cotas ao longo do tempo. A maioria paga todo mês!', dica: '<strong>Referência:</strong> Dividend yield anual acima de 8% em FIIs de qualidade é considerado atrativo.' },
      { num: '4', titulo: 'Riscos dos FIIs', desc: 'Vacância dos imóveis, inadimplência dos inquilinos, queda do setor imobiliário e alta da SELIC (concorre com renda fixa).', dica: '<strong>Proteção:</strong> Diversifique entre tipos e setores — não coloque tudo em um único FII.' },
      { num: '5', titulo: 'Como começar com FIIs?', desc: 'Abra conta em uma corretora, pesquise o IFIX (índice de FIIs), analise dividend yield, vacância e gestão.', dica: '<strong>Ação prática:</strong> Comece com R$100 no HGLG11, KNRI11 ou XPML11 — clássicos e diversificados.' },
    ],
    legenda_extra: 'Aprenda a investir em imóveis com pouco dinheiro e receba renda passiva mensalmente.',
    hashtags: '#fundosImobiliarios #FII #rendaPassiva #dividendos #b3 #educacaoFinanceira',
  },
  {
    badge: 'IBOVESPA',
    icone: '📈',
    titulo: 'O que é o Ibovespa?',
    subtitulo: 'O termômetro da bolsa brasileira',
    slides: [
      { num: '1', titulo: 'O que é o Ibovespa?', desc: 'É o principal índice da B3 (Bolsa de Valores do Brasil), com as ações mais negociadas do país.', dica: '<strong>Símbolo:</strong> Quando o Ibovespa sobe, significa que as principais empresas do Brasil estão valorizando.' },
      { num: '2', titulo: 'Quais ações fazem parte?', desc: 'Petrobras, Vale, Itaú, Bradesco, Magazine Luiza e mais ~80 empresas. Elas representam +80% do volume da B3.', dica: '<strong>Composição:</strong> Setor bancário, commodities e consumo doméstico dominam o índice.' },
      { num: '3', titulo: 'Como o Ibovespa é calculado?', desc: 'É ponderado por valor de mercado e liquidez. Revisado a cada 4 meses pela B3.', dica: '<strong>Fato:</strong> Uma ação pode entrar ou sair do Ibov — acompanhe as revisões para ajustar sua carteira.' },
      { num: '4', titulo: 'Investir via ETF', desc: 'O BOVA11 replica o Ibovespa automaticamente. Você compra uma cota e tem exposição a todas as ações do índice.', dica: '<strong>Estratégia passiva:</strong> BOVA11 tem taxa de 0,10% ao ano — muito menor que fundos de gestão ativa.' },
      { num: '5', titulo: 'Ibovespa vs. mundo', desc: 'O Brasil historicamente entrega retornos expressivos em dólar quando o ciclo de commodities é positivo.', dica: '<strong>Lembrete:</strong> Compare o Ibovespa em dólar (não só em reais) para avaliar a performance real.' },
    ],
    legenda_extra: 'Tudo que você precisa saber sobre o principal índice da bolsa brasileira em 5 slides.',
    hashtags: '#ibovespa #b3 #bolsadevalores #BOVA11 #ETF #educacaoFinanceira',
  },
  {
    badge: 'DIVIDENDOS',
    icone: '💰',
    titulo: 'Viver de Dividendos',
    subtitulo: 'A estratégia dos investidores de longo prazo',
    slides: [
      { num: '1', titulo: 'O que são dividendos?', desc: 'São a distribuição dos lucros de uma empresa para seus acionistas. Quem tem ações recebe em dinheiro na conta.', dica: '<strong>Regra geral:</strong> Empresas maduras e lucrativas distribuem mais. Foque em consistência, não no maior yield.' },
      { num: '2', titulo: 'Como calcular o Dividend Yield?', desc: 'DY = (dividendos pagos no ano ÷ preço da ação) × 100. Um DY de 6% significa R$6 por R$100 investidos.', dica: '<strong>Atenção:</strong> DY muito alto pode ser sinal de queda no preço da ação — analise o contexto!' },
      { num: '3', titulo: 'As maiores pagadoras do Brasil', desc: 'TAEE11, VIVT3, BBAS3, CMIG4 e ITUB4 são referência em histórico consistente de pagamentos.', dica: '<strong>Critério:</strong> Prefira empresas com 5+ anos de dividendos crescentes e payout saudável (<70%).' },
      { num: '4', titulo: 'Reinvestindo dividendos', desc: 'Reinvestir os dividendos recebidos acelera o efeito dos juros compostos e multiplica sua renda no longo prazo.', dica: '<strong>Poder dos juros compostos:</strong> Reinvestir por 10 anos pode dobrar seu patrimônio frente a quem saca os dividendos.' },
      { num: '5', titulo: 'Quanto preciso para viver de dividendos?', desc: 'Com DY médio de 6% ao ano, você precisa de ~R$2 milhões para ter R$10.000/mês em dividendos.', dica: '<strong>Caminho:</strong> Comece pequeno, reinvista tudo por anos e deixe o tempo trabalhar a seu favor.' },
    ],
    legenda_extra: 'Aprenda como construir uma carteira que paga renda passiva todo mês com dividendos.',
    hashtags: '#dividendos #rendaPassiva #dividendYield #acoes #educacaoFinanceira #investimentos',
  },
  {
    badge: 'TESOURO',
    icone: '🏛️',
    titulo: 'Tesouro Direto',
    subtitulo: 'O investimento mais seguro do Brasil',
    slides: [
      { num: '1', titulo: 'O que é o Tesouro Direto?', desc: 'Programa do governo federal para vender títulos públicos diretamente aos brasileiros pela internet.', dica: '<strong>Segurança:</strong> É garantido pelo Tesouro Nacional — o ativo mais seguro disponível no Brasil.' },
      { num: '2', titulo: 'Tipos de títulos', desc: 'Tesouro Selic (pós-fixado), Tesouro Prefixado (taxa travada) e Tesouro IPCA+ (protege da inflação + juro real).', dica: '<strong>Escolha certa:</strong> Curto prazo → Tesouro Selic. Longo prazo → IPCA+. Taxa travada → Prefixado.' },
      { num: '3', titulo: 'Como investir?', desc: 'Acesse pelo site do Tesouro Direto ou app da sua corretora. A partir de R$30 você já consegue comprar um título.', dica: '<strong>Dica:</strong> Muitas corretoras (XP, Rico, Nubank) têm taxa zero no Tesouro Direto.' },
      { num: '4', titulo: 'Riscos do Tesouro', desc: 'Se vender antes do vencimento, pode perder dinheiro (marcação a mercado). O ideal é levar até o vencimento.', dica: '<strong>Regra de ouro:</strong> Só invista no Tesouro dinheiro que você realmente não vai precisar antes do vencimento.' },
      { num: '5', titulo: 'Tesouro vs. Poupança', desc: 'Tesouro Selic rende mais que a poupança e tem liquidez diária — não há motivo para deixar na poupança.', dica: '<strong>Migração simples:</strong> Troque sua reserva de emergência da poupança para o Tesouro Selic agora.' },
    ],
    legenda_extra: 'Guia completo do Tesouro Direto: do básico à estratégia avançada para sua carteira.',
    hashtags: '#tesouroDireto #rendaFixa #tesouroSelic #IPCA #investimentos #educacaoFinanceira',
  },
  {
    badge: 'CDI',
    icone: '📊',
    titulo: 'O que é o CDI?',
    subtitulo: 'O índice que todo investidor precisa entender',
    slides: [
      { num: '1', titulo: 'O que é o CDI?', desc: 'Certificado de Depósito Interbancário: taxa que bancos cobram uns dos outros. Sempre muito próxima da SELIC.', dica: '<strong>Referência:</strong> CDI é o "benchmark" da renda fixa — se seu investimento rende menos que 100% CDI, está abaixo do mercado.' },
      { num: '2', titulo: 'CDB: o mais popular', desc: 'Certificado de Depósito Bancário paga uma % do CDI. 100% CDI = bom. 110% CDI = ótimo. Abaixo de 90% = ruim.', dica: '<strong>Comparação:</strong> Poupança rende ~70% do CDI. Já o Tesouro Selic rende ~99,9% do CDI. Fácil de decidir!' },
      { num: '3', titulo: 'LCI e LCA', desc: 'Letras de Crédito Imobiliário e do Agronegócio. Isentas de IR para pessoa física! Normalmente pagam 85-95% do CDI.', dica: '<strong>Equivalência:</strong> Uma LCI a 90% CDI pode ser equivalente a um CDB 110% CDI considerando a isenção de IR.' },
      { num: '4', titulo: 'Tabela regressiva de IR', desc: 'Até 6 meses: 22,5%. De 6m a 12m: 20%. De 12m a 24m: 17,5%. Acima de 24m: 15%. Quanto mais tempo, menos IR.', dica: '<strong>Estratégia:</strong> Para investimentos de curto prazo prefira LCI/LCA (isentas) a CDBs (com IR).' },
      { num: '5', titulo: 'CDI na prática', desc: 'Se o CDI está em 14,75% ao ano e você tem um CDB a 110% CDI, seu rendimento bruto anual é ~16,2% ao ano.', dica: '<strong>Ação:</strong> Acesse o comparador do Banco Central para sempre saber o CDI atual e comparar produtos.' },
    ],
    legenda_extra: 'Entenda o CDI de uma vez por todas e nunca mais aceite um investimento ruim.',
    hashtags: '#CDI #CDB #LCI #LCA #rendaFixa #educacaoFinanceira #investimentos',
  },
  {
    badge: 'BITCOIN',
    icone: '₿',
    titulo: 'Bitcoin para Iniciantes',
    subtitulo: 'Tudo que você precisa saber antes de investir',
    slides: [
      { num: '1', titulo: 'O que é o Bitcoin?', desc: 'A primeira criptomoeda do mundo, criada em 2009. Funciona sem banco central, em rede descentralizada.', dica: '<strong>Fato:</strong> O Bitcoin tem oferta máxima de 21 milhões de unidades — a escassez é programada no código.' },
      { num: '2', titulo: 'Como o preço é formado?', desc: 'Oferta e demanda, adoção institucional, regulação e sentimento do mercado. É altamente volátil!', dica: '<strong>Histórico:</strong> O Bitcoin já caiu -80% e depois subiu +1.000%. Volatilidade é a regra, não exceção.' },
      { num: '3', titulo: 'Como investir em Bitcoin?', desc: 'Exchanges (Binance, Mercado Bitcoin), ETFs de Bitcoin (HASH11, BITH11) ou fundos de cripto em corretoras.', dica: '<strong>Iniciante:</strong> ETFs de cripto no Brasil (HASH11) são mais seguros — sem precisar de carteira digital.' },
      { num: '4', titulo: 'Qual o risco?', desc: 'Alta volatilidade, risco regulatório, hacks em exchanges e possibilidade de perda total. Nunca invista o que não pode perder.', dica: '<strong>Regra de ouro:</strong> A maioria dos especialistas recomenda no máximo 5-10% da carteira em cripto.' },
      { num: '5', titulo: 'Bitcoin na carteira', desc: 'Funciona como reserva de valor (digital gold) e ativo de alta volatilidade. Ideal para diversificação global.', dica: '<strong>Estratégia DCA:</strong> Compre uma quantia fixa todo mês. Reduz o impacto da volatilidade no longo prazo.' },
    ],
    legenda_extra: 'Guia completo para entender Bitcoin antes de investir: riscos, estratégias e como começar.',
    hashtags: '#bitcoin #cripto #criptomoedas #HASH11 #educacaoFinanceira #investimentos',
  },
  {
    badge: 'BALANÇO',
    icone: '📋',
    titulo: 'Como Ler um Balanço',
    subtitulo: 'Analise empresas como um profissional',
    slides: [
      { num: '1', titulo: 'O que é um Balanço Patrimonial?', desc: 'Fotografia financeira da empresa: mostra o que ela tem (ativos), deve (passivos) e vale (patrimônio líquido).', dica: '<strong>Fórmula:</strong> Ativos = Passivos + Patrimônio Líquido. Sempre! Se não fechar, há erro nos dados.' },
      { num: '2', titulo: 'DRE: Demonstração de Resultados', desc: 'Mostra receita, custos, lucro bruto, EBITDA e lucro líquido. É o "extrato" da empresa no período.', dica: '<strong>Foco no EBITDA:</strong> Lucro operacional antes de juros e impostos — melhor para comparar empresas.' },
      { num: '3', titulo: 'Indicadores fundamentais', desc: 'P/L (preço/lucro), EV/EBITDA, ROE, Dívida Líquida/EBITDA e Dividend Yield. São a linguagem do mercado.', dica: '<strong>P/L baixo:</strong> Pode indicar ação barata — mas pesquise o motivo antes de comprar.' },
      { num: '4', titulo: 'Onde encontrar os dados?', desc: 'RI (Relações com Investidores) da empresa, B3, Fundamentus, Status Invest e apps de corretoras.', dica: '<strong>Gratuitamente:</strong> Acesse fundamentus.com.br para ver balanços completos de qualquer empresa da B3.' },
      { num: '5', titulo: 'Análise fundamentalista', desc: 'Combina balanço, DRE, fluxo de caixa e indicadores para decidir se a ação está cara ou barata.', dica: '<strong>Próximo passo:</strong> Compare os indicadores da empresa com a média do setor — contexto é tudo.' },
    ],
    legenda_extra: 'Aprenda a analisar empresas da B3 como um investidor profissional usando balanços e indicadores.',
    hashtags: '#analiseFundamentalista #balanco #acoes #b3 #educacaoFinanceira #investimentos',
  },
];

function carregarJson(arquivo, padrao) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return padrao; }
}

function salvarJson(arquivo, dados) {
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

function registrarVerificacao(resultado, mensagem, extra = {}) {
  const v = carregarJson(VERIFICACOES_FILE, []);
  v.unshift({ data: new Date().toISOString(), resultado, mensagem, ...extra });
  salvarJson(VERIFICACOES_FILE, v.slice(0, 200));
}

const { git } = require('./git-seguro.cjs');

function buildProgressDots(total, ativo) {
  return Array.from({ length: total }, (_, i) =>
    `<div class="progress-dot${i === ativo ? ' ativo' : ''}"></div>`
  ).join('');
}

function buildConteudoHtml(slide) {
  return `<div class="conteudo-item">
    <div class="conteudo-num">${slide.num}</div>
    <div class="conteudo-texto">
      <div class="conteudo-titulo">${slide.titulo}</div>
      <div class="conteudo-desc">${slide.desc}</div>
    </div>
  </div>`;
}

async function gerarSlide(tema, slide, idx, saida) {
  let html = fs.readFileSync(path.join(__dirname, 'card-educativo.html'), 'utf8');
  const subs = {
    '{{BADGE}}': tema.badge,
    '{{ICONE}}': tema.icone,
    '{{TITULO}}': slide.titulo,
    '{{SUBTITULO}}': tema.subtitulo,
    '{{CONTEUDO_HTML}}': buildConteudoHtml(slide),
    '{{DICA}}': slide.dica,
    '{{PROGRESS_DOTS}}': buildProgressDots(tema.slides.length, idx),
  };
  for (const [k, v] of Object.entries(subs)) html = html.replaceAll(k, v);

  const tmpHtml = path.join(__dirname, `_tmp_edu_${idx}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await browser.close();
  fs.unlinkSync(tmpHtml);
}

async function aguardarContainerPronto(id, tentativas = 30) {
  for (let i = 0; i < tentativas; i++) {
    const resp = await fetch(`${IG_API_BASE}/${id}?fields=status_code&access_token=${IG_TOKEN}`);
    const data = await resp.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Container com erro: ' + JSON.stringify(data));
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Timeout aguardando container: ' + id);
}

async function criarItemCarrossel(imageUrl) {
  const resp = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?image_url=${encodeURIComponent(imageUrl)}&is_carousel_item=true&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const data = await resp.json();
  if (!data.id) throw new Error('Erro ao criar item do carrossel: ' + JSON.stringify(data));
  await aguardarContainerPronto(data.id);
  return data.id;
}

async function publicarCarrossel(imageUrls, legenda) {
  const childIds = [];
  for (const url of imageUrls) childIds.push(await criarItemCarrossel(url));

  const resp = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media?media_type=CAROUSEL&children=${childIds.join(',')}&caption=${encodeURIComponent(legenda)}&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const data = await resp.json();
  if (!data.id) throw new Error('Erro ao criar carrossel: ' + JSON.stringify(data));

  await aguardarContainerPronto(data.id);

  const pub = await fetch(
    `${IG_API_BASE}/${IG_ACCOUNT_ID}/media_publish?creation_id=${data.id}&access_token=${IG_TOKEN}`,
    { method: 'POST' }
  );
  const pubData = await pub.json();
  if (!pubData.id) throw new Error('Erro ao publicar carrossel: ' + JSON.stringify(pubData));
  return pubData.id;
}

const HASHTAGS = '#educacaoFinanceira #investimentos #mercadoFinanceiro #bolsadevalores #b3 #financaspessoais #independenciaFinanceira #investidor #dicasFinanceiras #aprenda';

async function main() {
  if (!IG_TOKEN || !IG_ACCOUNT_ID) throw new Error('Defina IG_TOKEN e IG_ACCOUNT_ID.');
  const pagesToken = process.env.PAGES_TOKEN;
  if (!pagesToken) throw new Error('Defina PAGES_TOKEN.');

  const tema = TEMAS[semanaDoAno() % TEMAS.length];
  console.log(`Tema desta semana: ${tema.titulo} (${tema.badge})`);

  const ts = Date.now();

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);
  const cardsDir = path.join(PAGES_DIR, 'bdi-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const nomes = [];
  for (let i = 0; i < tema.slides.length; i++) {
    const nome = `edu-${ts}-slide${i + 1}.png`;
    console.log(`Gerando slide ${i + 1}/${tema.slides.length}...`);
    await gerarSlide(tema, tema.slides[i], i, path.join(cardsDir, nome));
    nomes.push(nome);
  }

  console.log('Enviando slides para GitHub Pages...');
  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git(`git add ${nomes.map(n => `bdi-cards/${n}`).join(' ')}`, PAGES_DIR);
  git(`git commit -m "Carrossel educativo: ${tema.titulo}"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  await new Promise(r => setTimeout(r, 15000));

  const urls = nomes.map(n => `${PAGES_RAW_BASE}/${n}`);

  const data = dataHojeBRT();
  const legenda = `📚 Educação Financeira — ${tema.titulo}\n\n${tema.legenda_extra}\n\n👆 Deslize para ver os ${tema.slides.length} slides!\n\n💬 Comente: Você já investe nisso? 👇\n\n📊 Mais conteúdo: https://bomdiainvestidor.com.br/\n\n${HASHTAGS} #${tema.badge.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  console.log('Publicando carrossel educativo no Instagram...');
  const postId = await publicarCarrossel(urls, legenda);
  console.log('Carrossel educativo publicado! ID:', postId);

  registrarVerificacao('carrossel_educativo', `Carrossel educativo publicado: ${tema.titulo}`, { postId, tema: tema.badge });

  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main().catch(e => {
  console.error('Erro ao publicar carrossel educativo:', e.message);
  registrarVerificacao('erro_carrossel_educativo', `Erro ao publicar carrossel educativo: ${e.message}`);
  process.exit(1);
});
