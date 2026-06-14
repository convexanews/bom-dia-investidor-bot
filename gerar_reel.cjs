// Gera um video (reel) a partir de uma lista de imagens (URLs), cada uma exibida
// por N segundos, formato 1080x1920 (9:16), usando ffmpeg.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

async function baixarImagem(url, destino) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao baixar imagem (${resp.status}): ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(destino, buf);
}

async function gerarReel(imagens, saida, segundosPorImagem = 3) {
  if (!imagens.length) throw new Error('Nenhuma imagem informada para gerar o reel.');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdi-reel-'));
  const arquivos = [];
  for (let i = 0; i < imagens.length; i++) {
    const dest = path.join(tmpDir, `img${i}.png`);
    await baixarImagem(imagens[i], dest);
    arquivos.push(dest);
  }

  const listaPath = path.join(tmpDir, 'lista.txt');
  let conteudo = '';
  for (const arq of arquivos) {
    conteudo += `file '${arq.replace(/\\/g, '/')}'\nduration ${segundosPorImagem}\n`;
  }
  // o demuxer concat ignora a duracao do ultimo arquivo, repete-se a entrada
  conteudo += `file '${arquivos[arquivos.length - 1].replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(listaPath, conteudo);

  if (!fs.existsSync(path.dirname(saida))) fs.mkdirSync(path.dirname(saida), { recursive: true });

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listaPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p" -r 30 -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${saida}"`,
    { stdio: 'inherit' }
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return saida;
}

module.exports = { gerarReel };
