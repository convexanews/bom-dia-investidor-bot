// Gera vídeo TikTok (9:16, 15-25s) com narração TTS a partir de uma notícia de alto impacto.
// Usa: puppeteer (frame), Edge TTS Neural (narração), ffmpeg (montagem final).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Microsoft Edge TTS Neural — voz masculina grave e natural pt-BR
// Voz: pt-BR-AntonioNeural (grave, profissional)
// Rate: -10% deixa levemente mais lento e imponente
async function gerarTTS(texto, saida) {
  const textoEscapado = texto.replace(/"/g, '\\"');
  execSync(
    `python -m edge_tts --voice "pt-BR-AntonioNeural" --rate "-8%" --pitch "-15Hz" --text "${textoEscapado}" --write-media "${saida}"`,
    { stdio: 'inherit', timeout: 60000 }
  );
  return saida;
}

// Gera o frame estático (PNG 1080x1920) usando o template HTML
async function gerarFrame(cfg, saida) {
  let template = fs.readFileSync(path.join(__dirname, 'tiktok-video.html'), 'utf8');

  template = template
    .replace('{{CATEGORIA}}', escapeHtml((cfg.categoria || 'MERCADO').toUpperCase()))
    .replace('{{MANCHETE}}', escapeHtml(cfg.manchete || ''))
    .replace('{{RESUMO}}', escapeHtml(cfg.resumo || ''))
    .replace('{{FONTE}}', escapeHtml(cfg.fonte || ''))
    .replace('{{IMAGEM_URL}}', cfg.imagem || '');

  const tmpHtml = path.join(__dirname, '_tmp_tiktok_frame.html');
  fs.writeFileSync(tmpHtml, template, 'utf8');

  if (!fs.existsSync(path.dirname(saida))) fs.mkdirSync(path.dirname(saida), { recursive: true });

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: saida, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await browser.close();
  fs.unlinkSync(tmpHtml);

  return saida;
}

// Monta o vídeo final: imagem estática + narração TTS + leve zoom (ken burns)
async function gerarVideoTikTok(cfg, saida) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-tiktok-'));
  const framePath = path.join(tmpDir, 'frame.png');
  const audioPath = path.join(tmpDir, 'narration.mp3');

  console.log('  Gerando frame visual...');
  await gerarFrame(cfg, framePath);

  // Monta texto para narração
  const textoNarracao = montarTextoNarracao(cfg);
  console.log('  Gerando narração TTS...');
  await gerarTTS(textoNarracao, audioPath);

  // Estima duração do áudio pelo tamanho do texto (~13 chars/segundo em pt-BR TTS)
  // Se ffprobe estiver disponível, usa duração exata
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

  if (!fs.existsSync(path.dirname(saida))) fs.mkdirSync(path.dirname(saida), { recursive: true });

  // Ken Burns: leve zoom de 1.0 a 1.08 durante a duração do vídeo
  console.log(`  Montando vídeo (${duracaoAudio}s)...`);
  execSync(
    `ffmpeg -y -loop 1 -i "${framePath}" -i "${audioPath}" ` +
    `-vf "zoompan=z='min(zoom+0.0003,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duracaoAudio * 30}:s=1080x1920:fps=30,format=yuv420p" ` +
    `-c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -movflags +faststart ` +
    `-shortest "${saida}"`,
    { stdio: 'inherit', timeout: 120000 }
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('  Vídeo TikTok gerado:', saida);
  return saida;
}

function montarTextoNarracao(cfg) {
  const partes = ['Atenção investidor!'];

  if (cfg.manchete) {
    partes.push(cfg.manchete.replace(/\s+/g, ' ').trim() + '.');
  }

  if (cfg.resumo) {
    let resumo = cfg.resumo.replace(/\s+/g, ' ').trim();
    if (resumo.length > 250) resumo = resumo.slice(0, 247) + '...';
    partes.push(resumo);
  }

  partes.push('Acompanhe o Bom Dia Investidor para mais notícias do mercado financeiro.');

  return partes.join(' ');
}

function montarLegendaTikTok(cfg) {
  const hashtags = '#mercadofinanceiro #investimentos #bolsa #ibovespa #acoes #economia #dolar #investidor #financas #tiktokfinance #bomdiainvestidor';
  return `🔴 ${cfg.manchete}\n\n📊 ${cfg.resumo || ''}\n\nFonte: ${cfg.fonte || ''}\n\n${hashtags}`;
}

module.exports = { gerarVideoTikTok, gerarFrame, gerarTTS, montarLegendaTikTok, montarTextoNarracao };

if (require.main === module) {
  const cfg = JSON.parse(process.argv[2] || '{}');
  const saida = process.argv[3] || path.join(__dirname, 'output', 'tiktok-video.mp4');
  gerarVideoTikTok(cfg, saida).catch(e => { console.error(e); process.exit(1); });
}
