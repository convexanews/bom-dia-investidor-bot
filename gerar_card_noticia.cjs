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

async function gerarCard(cfg, saida) {
  const isStory = cfg.formato === 'story';
  const arquivoTemplate = isStory ? 'card-noticia-story.html' : 'card-noticia.html';
  const altura = isStory ? 1920 : 1350;

  let template = fs.readFileSync(path.join(__dirname, arquivoTemplate), 'utf8');

  template = template
    .replace(/\{\{CATEGORIA\}\}/g, escapeHtml((cfg.categoria || 'MERCADO').toUpperCase()))
    .replace(/\{\{MANCHETE\}\}/g, escapeHtml(cfg.mancheteVisual || cfg.manchete || ''))
    .replace(/\{\{IMAGEM_URL\}\}/g, cfg.imagem || '')
    .replace(/\{\{FONTE\}\}/g, escapeHtml(cfg.fonte || ''))
    .replace(/\{\{PERGUNTA\}\}/g, escapeHtml(cfg.pergunta || ''))
    .replace(/\{\{ACENTO_GRADIENTE\}\}/g, cfg.acentoGradiente || 'linear-gradient(135deg, #00D184, #00A8E8)')
    .replace(/\{\{ACENTO_TEXTO\}\}/g, cfg.acentoTexto || '#04150f')
    .replace(/\{\{ACENTO_COR\}\}/g, cfg.acentoCor || '#00D184');

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
