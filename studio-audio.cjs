const fs = require('fs');
const path = require('path');

const VOZES_STUDIO = [
  { id: 'pt-BR-FranciscaNeural', nome: 'Francisca — jornalística', genero: 'feminina' },
  { id: 'pt-BR-AntonioNeural', nome: 'Antônio — informativa', genero: 'masculina' },
  { id: 'pt-BR-ThalitaNeural', nome: 'Thalita — dinâmica', genero: 'feminina' },
];

function limparTextoNarracao(texto) {
  const limpo = String(texto || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpo.length < 20) throw new Error('O roteiro da narração está curto demais.');
  if (limpo.length > 1800) throw new Error('A narração pode ter no máximo 1.800 caracteres.');
  return limpo;
}

function validarConfiguracao(config = {}) {
  const voice = VOZES_STUDIO.some(item => item.id === config.voice) ? config.voice : VOZES_STUDIO[0].id;
  const rateNumber = Math.max(-30, Math.min(30, Number(config.rate) || -4));
  const pitchNumber = Math.max(-20, Math.min(20, Number(config.pitch) || 0));
  const volumeNumber = Math.max(-50, Math.min(50, Number(config.volume) || 0));
  return {
    voice,
    rate: `${rateNumber >= 0 ? '+' : ''}${rateNumber}%`,
    pitch: `${pitchNumber >= 0 ? '+' : ''}${pitchNumber}%`,
    volume: `${volumeNumber >= 0 ? '+' : ''}${volumeNumber}%`,
  };
}

function carregarEdgeTts() {
  try { return require('node-edge-tts'); }
  catch {
    throw new Error('O gerador de voz ainda não está instalado. Execute o preparador do Studio e tente novamente.');
  }
}

async function gerarNarracao({ texto, voice, rate, pitch, volume, saida }) {
  const roteiro = limparTextoNarracao(texto);
  if (!saida || path.extname(saida).toLowerCase() !== '.mp3') throw new Error('Destino de narração inválido.');
  const config = validarConfiguracao({ voice, rate, pitch, volume });
  const { EdgeTTS } = carregarEdgeTts();
  if (typeof EdgeTTS !== 'function') throw new Error('O módulo de narração instalado é incompatível.');
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  const tts = new EdgeTTS({ ...config, lang: 'pt-BR', outputFormat: 'audio-24khz-96kbitrate-mono-mp3', timeout: 30000 });
  await tts.ttsPromise(roteiro, saida);
  const stat = fs.statSync(saida);
  if (stat.size < 1024) throw new Error('A voz foi gerada, mas o arquivo de áudio ficou inválido.');
  return { arquivo: saida, bytes: stat.size, roteiro, config };
}

function estimarDuracaoNarracao(texto, palavrasPorMinuto = 150) {
  const palavras = limparTextoNarracao(texto).split(/\s+/).length;
  return Math.max(3, Math.ceil((palavras / palavrasPorMinuto) * 60));
}

module.exports = { VOZES_STUDIO, limparTextoNarracao, validarConfiguracao, gerarNarracao, estimarDuracaoNarracao };
