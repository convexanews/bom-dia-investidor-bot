// Gera um card de noticia financeira (feed 1080x1350 ou story 1080x1920) para o "Bom Dia Investidor".
// Uso: node gerar_card_noticia.cjs '<json_da_config>' <arquivo_saida.png>
// cfg.formato === 'story' gera a versao 1080x1920.
const path = require('path');
const fs = require('fs');
const { renderizarTemplate } = require('./renderizar_template.cjs');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Gradiente de fundo por sentimento quando não há imagem
const FALLBACK_GRADIENTES = {
  positivo:  'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
  negativo:  'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)',
  selic:     'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
  cambio:    'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)',
  default:   'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
};

const FALLBACK_ICON_CORES = {
  positivo: '#2e7d32',
  negativo: '#c62828',
  selic:    '#1565c0',
  cambio:   '#283593',
  default:  '#0f172a',
};

// Tamanho adaptativo da manchete baseado no comprimento do texto
function calcularTamanhoManchete(texto, isStory) {
  const len = (texto || '').length;
  const base = isStory ? 70 : 62;
  if (len > 120) return Math.round(base * 0.72);
  if (len > 90) return Math.round(base * 0.82);
  if (len > 60) return Math.round(base * 0.92);
  return base;
}

async function gerarCard(cfg, saida) {
  const isStory = cfg.formato === 'story';
  const arquivoTemplate = isStory ? 'card-noticia-story.html' : 'card-noticia.html';
  const altura = isStory ? 1920 : 1350;

  const sentimento = cfg.sentimento || 'default';
  const mancheteTexto = cfg.mancheteVisual || cfg.manchete || '';
  const fallbackBg = FALLBACK_GRADIENTES[sentimento] || FALLBACK_GRADIENTES.default;
  const fallbackIconCor = FALLBACK_ICON_CORES[sentimento] || FALLBACK_ICON_CORES.default;
  const mancheteFontSize = calcularTamanhoManchete(mancheteTexto, isStory);

  let template = fs.readFileSync(path.join(__dirname, arquivoTemplate), 'utf8');

  template = template
    .replace(/\{\{CATEGORIA\}\}/g, escapeHtml((cfg.categoria || 'MERCADO').toUpperCase()))
    .replace(/\{\{MANCHETE\}\}/g, escapeHtml(mancheteTexto))
    .replace(/\{\{IMAGEM_URL\}\}/g, cfg.imagem || '')
    .replace(/\{\{FONTE\}\}/g, escapeHtml(cfg.fonte || ''))
    .replace(/\{\{PERGUNTA\}\}/g, escapeHtml(cfg.pergunta || ''))
    .replace(/\{\{ACENTO_GRADIENTE\}\}/g, cfg.acentoGradiente || 'linear-gradient(135deg, #00D184, #00A8E8)')
    .replace(/\{\{ACENTO_TEXTO\}\}/g, cfg.acentoTexto || '#04150f')
    .replace(/\{\{ACENTO_COR\}\}/g, cfg.acentoCor || '#00D184')
    .replace(/\{\{FALLBACK_BG\}\}/g, fallbackBg)
    .replace(/\{\{FALLBACK_ICON_COR\}\}/g, fallbackIconCor)
    .replace(/\{\{MANCHETE_FONT_SIZE\}\}/g, String(mancheteFontSize));

  return renderizarTemplate({ html: template, saida, largura: 1080, altura, nome: `card_noticia_${isStory ? 'story' : 'feed'}` });
}

if (require.main === module) {
  (async () => {
    const cfg = JSON.parse(process.argv[2]);
    const saida = process.argv[3] || path.join(__dirname, 'card-noticia-saida.png');
    await gerarCard(cfg, saida);
    console.log('Card gerado:', saida);
  })();
}

module.exports = { gerarCard };
