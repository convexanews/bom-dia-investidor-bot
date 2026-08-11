// Separa os formatos do feed por relevância: o fato excepcional pede vídeo;
// uma pauta relevante com mais contexto pede carrossel.
const PESO_MINIMO_FEED = 70;
const PESO_MINIMO_REEL = 85;

function selecionarFormatoFeed(peso) {
  const valor = Number(peso || 0);
  if (valor < PESO_MINIMO_FEED) return null;
  return valor >= PESO_MINIMO_REEL ? 'reel' : 'carrossel';
}

module.exports = { PESO_MINIMO_FEED, PESO_MINIMO_REEL, selecionarFormatoFeed };
