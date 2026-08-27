// Gera vídeo TikTok (9:16, 15-25s) com narração TTS a partir de uma notícia de alto impacto.
// Usa: puppeteer (frame), Edge TTS Neural (narração), ffmpeg (montagem final).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { renderizarTemplate } = require('./renderizar_template.cjs');
const { montarRoteiroReel, montarCenasReel, quebrarLegendas } = require('./formato_editorial.cjs');
const { renderStudioSlide } = require('./studio-renderer-cloud.cjs');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// TTS com vozes exclusivamente pt-BR. Evitamos vozes multilíngues para que
// o Reel não mude a pronúncia/idioma da narração durante a publicação.
const VOZ_TTS_PRIMARIA = 'pt-BR-FranciscaNeural';
const VOZ_TTS_RESERVA = 'pt-BR-AntonioNeural';

function validarTextoNarracaoEmPortugues(texto) {
  const normalizado = String(texto || '').replace(/\s+/g, ' ').trim();
  if (normalizado.length < 40) {
    throw new Error('Narração curta demais para validação de idioma.');
  }

  // Indicadores inequivocamente espanhóis. Dois ou mais bloqueiam a publicação
  // para evitar falsos positivos em nomes próprios ou termos de mercado.
  const termosEspanhois = normalizado.match(/\b(?:los|las|del|unos|unas|pero|también|desde|hacia|después|mientras|aunque|según)\b/gi) || [];
  if (termosEspanhois.length >= 2) {
    throw new Error('Narração bloqueada: texto aparenta estar em espanhol.');
  }

  const marcadoresPtBr = normalizado.match(/\b(?:o|a|os|as|um|uma|dos|das|não|para|com|que|de|em|por|sobre|após|entre|mercado|investidores|notícia)\b/gi) || [];
  if (marcadoresPtBr.length < 3) {
    throw new Error('Narração bloqueada: não foi possível confirmar texto em português.');
  }
  return normalizado;
}

function validarArquivoTTS(saida) {
  if (!fs.existsSync(saida) || fs.statSync(saida).size < 1024) {
    throw new Error('Narração TTS não foi gerada corretamente.');
  }
}

async function gerarTTS(texto, saida) {
  const textoLimpo = validarTextoNarracaoEmPortugues(texto).slice(0, 900);
  try {
    execFileSync('python', ['-m', 'edge_tts', '--voice', VOZ_TTS_PRIMARIA, '--rate=-4%', '--text', textoLimpo, '--write-media', saida], { stdio: 'inherit', timeout: 60000 });
    validarArquivoTTS(saida);
  } catch {
    execFileSync('python', ['-m', 'edge_tts', '--voice', VOZ_TTS_RESERVA, '--rate=-4%', '--text', textoLimpo, '--write-media', saida], { stdio: 'inherit', timeout: 60000 });
    validarArquivoTTS(saida);
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

function formatarTempoASS(segundos) {
  const totalCentissegundos = Math.max(0, Math.round(Number(segundos || 0) * 100));
  const horas = Math.floor(totalCentissegundos / 360000);
  const minutos = Math.floor((totalCentissegundos % 360000) / 6000).toString().padStart(2, '0');
  const secs = Math.floor((totalCentissegundos % 6000) / 100).toString().padStart(2, '0');
  const centesimos = (totalCentissegundos % 100).toString().padStart(2, '0');
  return `${horas}:${minutos}:${secs}.${centesimos}`;
}

function escaparTextoASS(texto) {
  return String(texto || '')
    .replace(/\\/g, '／')
    .replace(/[{}]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Legendas do Reel ficam em uma faixa curta sobre a área da imagem. O arquivo
// ASS fixa a resolução de referência em 1080x1920, evitando que o libass
// aumente a fonte de forma imprevisível ao converter um SRT automaticamente.
function gerarLegendasStudio(cenas, duracaoTotal, assPath) {
  const cenasValidas = (Array.isArray(cenas) ? cenas : []).filter(Boolean);
  if (!cenasValidas.length) throw new Error('Não há cenas para gerar as legendas do Reel.');

  const duracaoPorCena = duracaoTotal / cenasValidas.length;
  const dialogos = [];
  cenasValidas.forEach((cena, indiceCena) => {
    const texto = `${cena.titulo || ''}. ${cena.texto || ''}`.replace(/\s+/g, ' ').trim();
    const blocos = quebrarLegendas([texto], 42);
    if (!blocos.length) return;
    const duracaoPorBloco = duracaoPorCena / blocos.length;
    blocos.forEach((bloco, indiceBloco) => {
      const inicio = (indiceCena * duracaoPorCena) + (indiceBloco * duracaoPorBloco);
      const fim = Math.min(inicio + duracaoPorBloco, duracaoTotal);
      dialogos.push(`Dialogue: 0,${formatarTempoASS(inicio)},${formatarTempoASS(fim)},Legenda,,0,0,0,,${escaparTextoASS(bloco)}`);
    });
  });

  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Legenda,Arial,34,&H00FFFFFF,&H00FFFFFF,&H78000000,&H78000000,-1,0,0,0,100,100,0,0,3,10,0,8,130,130,410,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogos.join('\n')}
`;
  fs.writeFileSync(assPath, ass, 'utf8');
  return { path: assPath, blocos: dialogos.length, conteudo: ass };
}

// Anima cada frame estático com zoom/pan e une as cenas com transições.
// Isso evita o efeito de “imagem fixa com legenda” e cria ritmo visual mesmo
// quando a matéria oferece apenas uma foto de agência.
function montarFiltroVideoAnimado(totalCenas, duracaoPorCena, legendaPath) {
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
  const legendaEscaped = legendaPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  partes.push(`[base]subtitles='${legendaEscaped}',format=yuv420p[vout]`);
  return partes.join(';');
}

// Monta o vídeo final com quatro cenas, narração TTS e legendas sincronizadas.
async function gerarVideoTikTok(cfg, saida, { project = null } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-tiktok-'));
  const audioPath = path.join(tmpDir, 'narration.mp3');
  const legendaPath = path.join(tmpDir, 'legendas.ass');
  const cenas = project?.format === 'reel' && Array.isArray(project.slides)
    ? project.slides.map(slide => ({ etapa: slide.category, titulo: slide.headline, texto: slide.body, chamada: slide.cta, tema: 'neutro' }))
    : montarCenasReel(cfg);
  const framePaths = [];

  console.log(`  Gerando ${cenas.length} cenas visuais...`);
  for (let i = 0; i < cenas.length; i++) {
    const framePath = path.join(tmpDir, `cena-${i + 1}.png`);
    if (project) await renderStudioSlide(project, i, framePath);
    else await gerarFrame(cfg, cenas[i], i + 1, cenas.length, framePath);
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

  // Frases curtas e posição segura: não cobre o conteúdo editorial do Studio.
  const legendas = gerarLegendasStudio(cenas, duracaoAudio - 1, legendaPath);
  console.log(`  Legendas Studio: ${legendas.blocos} blocos curtos`);

  if (!fs.existsSync(path.dirname(saida))) fs.mkdirSync(path.dirname(saida), { recursive: true });

  const duracaoPorCena = Math.max(3.5, (duracaoAudio + ((cenas.length - 1) * 0.35)) / cenas.length);
  const entradasVisuais = framePaths.map(frame => `-loop 1 -t ${duracaoPorCena.toFixed(3)} -i "${frame}"`).join(' ');
  let filtro = montarFiltroVideoAnimado(cenas.length, duracaoPorCena, legendaPath);
  const musicPath = path.join(__dirname, 'noticias-trilha.mp3');
  const hasMusic = fs.existsSync(musicPath);
  if (hasMusic) filtro += `;[${cenas.length}:a]volume=1[voz];[${cenas.length + 1}:a]volume=0.14,afade=t=in:st=0:d=0.5[musica];[voz][musica]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
  const musicInput = hasMusic ? `-stream_loop -1 -i "${musicPath}"` : '';
  const audioMap = hasMusic ? '-map "[aout]"' : `-map ${cenas.length}:a`;

  console.log(`  Montando vídeo animado (${duracaoAudio}s) com ${cenas.length} cenas, transições e legendas...`);
  execSync(
    `ffmpeg -y ${entradasVisuais} -i "${audioPath}" ${musicInput} -filter_complex "${filtro}" -map "[vout]" ${audioMap} ` +
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

module.exports = { gerarVideoTikTok, gerarFrame, gerarTTS, gerarLegendasStudio, montarLegendaTikTok, montarTextoNarracao, montarBlocosLegenda, montarFiltroVideoAnimado, validarTextoNarracaoEmPortugues, VOZ_TTS_PRIMARIA, VOZ_TTS_RESERVA };

if (require.main === module) {
  const cfg = JSON.parse(process.argv[2] || '{}');
  const saida = process.argv[3] || path.join(__dirname, 'output', 'tiktok-video.mp4');
  gerarVideoTikTok(cfg, saida).catch(e => { console.error(e); process.exit(1); });
}
