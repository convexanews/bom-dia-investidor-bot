const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function chaveNarracao({ texto, voice, rate, pitch, volume }) {
  const roteiro = limparTextoNarracao(texto);
  const config = validarConfiguracao({ voice, rate, pitch, volume });
  return crypto.createHash('sha256')
    .update(JSON.stringify({ versao: 1, roteiro, config }))
    .digest('hex');
}

function mensagemErroNarracao(error) {
  const detalhes = [
    error?.message,
    error?.cause?.message,
    error?.stderr,
    typeof error === 'string' ? error : '',
  ].map(item => String(item || '').trim()).filter(Boolean).join(' — ');
  if (/instalado|incompatível|curto demais|máximo|destino|inválido/i.test(detalhes)) return detalhes;
  return 'O serviço de voz neural não respondeu. Verifique a internet e tente novamente em alguns segundos.';
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function gerarNarracao({ texto, voice, rate, pitch, volume, saida }) {
  const roteiro = limparTextoNarracao(texto);
  if (!saida || path.extname(saida).toLowerCase() !== '.mp3') throw new Error('Destino de narração inválido.');
  const config = validarConfiguracao({ voice, rate, pitch, volume });
  const { EdgeTTS } = carregarEdgeTts();
  if (typeof EdgeTTS !== 'function') throw new Error('O módulo de narração instalado é incompatível.');
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  if (fs.existsSync(saida) && fs.statSync(saida).size >= 1024) {
    const stat = fs.statSync(saida);
    return { arquivo: saida, bytes: stat.size, roteiro, config, cache: true };
  }
  fs.rmSync(saida, { force: true });

  let ultimoErro;
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    const temporario = `${saida}.${process.pid}-${Date.now()}-${tentativa}.tmp`;
    try {
      const tts = new EdgeTTS({ ...config, lang: 'pt-BR', outputFormat: 'audio-24khz-96kbitrate-mono-mp3', timeout: 30000 });
      await tts.ttsPromise(roteiro, temporario);
      const stat = fs.statSync(temporario);
      if (stat.size < 1024) throw new Error('A voz foi gerada, mas o arquivo de áudio ficou inválido.');
      if (!fs.existsSync(saida)) fs.renameSync(temporario, saida);
      else fs.rmSync(temporario, { force: true });
      const finalStat = fs.statSync(saida);
      return { arquivo: saida, bytes: finalStat.size, roteiro, config, cache: false };
    } catch (error) {
      ultimoErro = error;
      fs.rmSync(temporario, { force: true });
      if (tentativa < 3) await esperar(tentativa * 700);
    }
  }
  throw new Error(mensagemErroNarracao(ultimoErro));
}

function estimarDuracaoNarracao(texto, palavrasPorMinuto = 150) {
  const palavras = limparTextoNarracao(texto).split(/\s+/).length;
  return Math.max(3, Math.ceil((palavras / palavrasPorMinuto) * 60));
}

module.exports = { VOZES_STUDIO, limparTextoNarracao, validarConfiguracao, chaveNarracao, mensagemErroNarracao, gerarNarracao, estimarDuracaoNarracao };
