// O feed prioriza Reels: toda pauta relevante recebe o formato de maior alcance.
// Carrossel só é usado quando alguém o força manualmente via FORCE_FORMAT.
const PESO_MINIMO_FEED = 70;
const PESO_MINIMO_REEL = PESO_MINIMO_FEED;

function selecionarFormatoFeed(peso) {
  const valor = Number(peso || 0);
  if (valor < PESO_MINIMO_FEED) return null;
  return 'reel';
}

module.exports = { PESO_MINIMO_FEED, PESO_MINIMO_REEL, selecionarFormatoFeed };
