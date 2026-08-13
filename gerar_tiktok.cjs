// Gera vídeo TikTok (9:16, 15-25s) com narração TTS a partir de uma notícia de alto impacto.
// Usa: puppeteer (frame), Edge TTS Neural (narração), ffmpeg (montagem final).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { renderizarTemplate } = require('./renderizar_template.cjs');
const { montarRoteiroReel, montarCenasReel, quebrarLegendas } = require('./formato_editorial.cjs');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Microsoft Edge TTS Neural — voz feminina natural pt-BR
// Voz: pt-BR-ThalitaMultilingualNeural (a mais humana disponível);
// fallback FranciscaNeural se a multilingual falhar.
async function gerarTTS(texto, saida) {
  const textoLimpo = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 900);
  try {
    execFileSync('python', ['-m', 'edge_tts', '--voice', 'pt-BR-ThalitaMultilingualNeural', '--rate=-4%', '--text', textoLimpo, '--write-media', saida], { stdio: 'inherit', timeout: 60000 });
  } catch {
    execFileSync('python', ['-m', 'edge_tts', '--voice', 'pt-BR-FranciscaNeural', '--rate=-4%', '--text', textoLimpo, '--write-media', saida], { stdio: 'inherit', timeout: 60000 });
  }
  return saida;
}

let logoB64Cache = null;
function getLogoB64() {
  if (!logoB64Cache) {
    const buf = fs.readFileSync(path.join(__dirname, 'logo-bdi.jpeg'));
    logoB64Cache = 'data:image/jpeg;base64,' + buf.toString('base64');
  }
  return logoB64Cache;
}

// Gera uma das cenas visuais (PNG 1080x1920) usando o template HTML.
async function gerarFrame(cfg, cena, numeroCena, totalCenas, saida) {
  // Carregado somente na renderização: mantém as regras de narrativa testáveis
  // mesmo em ambientes locais que não instalaram as dependências de imagem.
  let template = fs.readFileSync(path.join(__dirname, 'tiktok-video.html'), 'utf8');

  template = template
    .replace('{{LOGO_B64}}', getLogoB64())
    .replace('{{CATEGORIA}}', escapeHtml((cfg.categoria || 'MERCADO').toUpperCase()))
    .replace('{{ETAPA}}', escapeHtml(cena.etapa || 'MERCADO'))
    .replace('{{CENA_TITULO}}', escapeHtml(cena.titulo || cfg.mancheteVisual || cfg.manchete || ''))
    .replace('{{CENA_TEXTO}}', escapeHtml((cena.texto || '').slice(0, 190)))
    .replace('{{CHAMADA}}', escapeHtml(cena.chamada || 'ACOMPANHE'))
    .replace(/\{\{TEMA\}\}/g, ['positivo', 'negativo'].includes(cena.tema) ? cena.tema : 'neutro')
    .replace(/\{\{CENA_NUMERO\}\}/g, String(numeroCena))
    .replace(/\{\{TOTAL_CENAS\}\}/g, String(totalCenas))
    .replace('{{FONTE}}', escapeHtml(cfg.fonte || ''))
    .replace('{{IMAGEM_URL}}', cfg.imagem || '');

  return renderizarTemplate({ html: template, saida, largura: 1080, altura: 1920, nome: `tiktok_frame_${numeroCena}` });
}

function gerarSRT(blocos, duracaoTotal, srtPath) {
  const tempoPorBloco = duracaoTotal / blocos.length;
  let srt = '';
  blocos.forEach((texto, i) => {
    const inicio = i * tempoPorBloco;
    const fim = Math.min((i + 1) * tempoPorBloco, duracaoTotal);
    const fmtT = (s) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = Math.floor(s % 60).toString().padStart(2, '0');
      const ms = Math.floor((s % 1) * 1000).toString().padStart(3, '0');
      return `${h}:${m}:${sec},${ms}`;
    };
    srt += `${i + 1}\n${fmtT(inicio)} --> ${fmtT(fim)}\n${texto}\n\n`;
  });
  fs.writeFileSync(srtPath, srt, 'utf8');
  return srtPath;
}

// Anima cada frame estático com zoom/pan e une as cenas com transições.
// Isso evita o efeito de “imagem fixa com legenda” e cria ritmo visual mesmo
// quando a matéria oferece apenas uma foto de agência.
function montarFiltroVideoAnimado(totalCenas, duracaoPorCena, srtPath) {
  const fade = 0.35;
  const partes = [];
  for (let i = 0; i < totalCenas; i++) {
    const direcao = i % 2 === 0 ? 1 : -1;
    partes.push(
      `[${i}:v]scale=1280:2276,zoompan=z='min(zoom+0.00075,1.12)':x='iw/2-(iw/zoom/2)+${direcao}*sin(on/18)*18':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,trim=duration=${duracaoPorCena.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
    );
  }
  let anterior = '[v0]';
  for (let i = 1; i < totalCenas; i++) {
    const proximo = i === totalCenas - 1 ? '[base]' : `[mix${i}]`;
    const offset = ((duracaoPorCena - fade) * i).toFixed(3);
    partes.push(`${anterior}[v${i}]xfade=transition=fade:duration=${fade}:offset=${offset}${proximo}`);
    anterior = proximo;
  }
  const srtEscaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const estilo = "FontName=Arial,FontSize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=2,Shadow=1,MarginV=42,Alignment=2,Bold=1";
  partes.push(`[base]subtitles='${srtEscaped}':force_style='${estilo}',format=yuv420p[vout]`);
  return partes.join(';');
}

// Monta o vídeo final com quatro cenas, narração TTS e legendas sincronizadas.
async function gerarVideoTikTok(cfg, saida) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-tiktok-'));
  const audioPath = path.join(tmpDir, 'narration.mp3');
  const srtPath = path.join(tmpDir, 'legendas.srt');
  const cenas = montarCenasReel(cfg);
  const framePaths = [];

  console.log(`  Gerando ${cenas.length} cenas visuais...`);
  for (let i = 0; i < cenas.length; i++) {
    const framePath = path.join(tmpDir, `cena-${i + 1}.png`);
    await gerarFrame(cfg, cenas[i], i + 1, cenas.length, framePath);
    framePaths.push(framePath);
  }

  const textoNarracao = cenas.map(cena => `${cena.titulo}. ${cena.texto}`).join(' ');
  console.log('  Gerando narração TTS...');
  await gerarTTS(textoNarracao, audioPath);

  let duracaoAudio;
  try {
    const durInfo = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
      { encoding: 'utf8' }
    ).trim();
    duracaoAudio = Math.ceil(parseFloat(durInfo)) + 2;
  } catch {
    duracaoAudio = Math.ceil(textoNarracao.length / 13) + 3;
    console.log(`  (ffprobe não disponível, duração estimada: ${duracaoAudio}s)`);
  }

  // Gera legendas SRT sincronizadas
  const blocos = cenas.map(cena => cena.texto);
  gerarSRT(blocos, duracaoAudio - 1, srtPath);
  console.log(`  Legendas: ${blocos.length} blocos`);

  if (!fs.existsSync(path.dirname(saida))) fs.mkdirSync(path.dirname(saida), { recursive: true });

  const duracaoPorCena = Math.max(3.5, (duracaoAudio + ((cenas.length - 1) * 0.35)) / cenas.length);
  const entradasVisuais = framePaths.map(frame => `-loop 1 -t ${duracaoPorCena.toFixed(3)} -i "${frame}"`).join(' ');
  const filtro = montarFiltroVideoAnimado(cenas.length, duracaoPorCena, srtPath);

  console.log(`  Montando vídeo animado (${duracaoAudio}s) com ${cenas.length} cenas, transições e legendas...`);
  execSync(
    `ffmpeg -y ${entradasVisuais} -i "${audioPath}" -filter_complex "${filtro}" -map "[vout]" -map ${cenas.length}:a ` +
    `-c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -movflags +faststart ` +
    `-shortest "${saida}"`,
    { stdio: 'inherit', timeout: 180000 }
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('  Vídeo TikTok gerado:', saida);
  return saida;
}

function montarTextoNarracao(cfg) {
  return montarRoteiroReel(cfg).join(' ');
}

function montarBlocosLegenda(cfg) {
  return quebrarLegendas(montarRoteiroReel(cfg), 54);
}

function montarLegendaTikTok(cfg) {
  const texto = `${cfg.manchete || ''} ${cfg.resumo || ''}`.toLowerCase();
  const tema = /selic|copom|juros|renda fixa|tesouro/.test(texto) ? '#selic #rendafixa #copom'
    : /bitcoin|cripto|ethereum/.test(texto) ? '#bitcoin #cripto #mercadocripto'
      : /fii|fundo imobili/.test(texto) ? '#fiis #fundosimobiliarios #ifix'
        : /dolar|cambio/.test(texto) ? '#dolar #cambio #economia'
          : '#ibovespa #acoes #mercadofinanceiro';
  const resumo = String(cfg.resumo || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  return `📌 ${cfg.manchete}\n\nO que aconteceu: ${resumo}\n\nFonte: ${cfg.fonte || 'não informada'}. Conteúdo informativo; não é recomendação de investimento.\n\n${tema} #investimentos #bomdiainvestidor`;
}

module.exports = { gerarVideoTikTok, gerarFrame, gerarTTS, montarLegendaTikTok, montarTextoNarracao, montarBlocosLegenda, montarFiltroVideoAnimado };

if (require.main === module) {
  const cfg = JSON.parse(process.argv[2] || '{}');
  const saida = process.argv[3] || path.join(__dirname, 'output', 'tiktok-video.mp4');
  gerarVideoTikTok(cfg, saida).catch(e => { console.error(e); process.exit(1); });
}
