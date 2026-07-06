// Remove cards (PNG) e vídeos (MP4) com mais de 7 dias do repo do GitHub Pages.
// O Instagram copia a mídia no momento da publicação, então os arquivos antigos
// só ocupam espaço — e o site publicado tem limite de 1GB no GitHub Pages
// (quando estoura, o deploy falha com "Deployment failed, try again later").
const fs = require('fs');
const path = require('path');
const { git } = require('./git-seguro.cjs');

const PAGES_DIR = path.join(__dirname, 'pages-repo-limpeza');
const PAGES_REPO = 'convexanews/convexanews.github.io';
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function main() {
  if (!process.env.PAGES_TOKEN) throw new Error('Defina PAGES_TOKEN.');

  if (fs.existsSync(PAGES_DIR)) fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  git(`git clone --depth 1 https://x-access-token@github.com/${PAGES_REPO}.git "${PAGES_DIR}"`, __dirname);

  let removidos = 0;
  let bytes = 0;
  for (const dir of ['bdi-cards', 'bdi-tiktok']) {
    const full = path.join(PAGES_DIR, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      const m = f.match(/(\d{13})/);
      const st = fs.statSync(path.join(full, f));
      const idade = m ? Date.now() - parseInt(m[1], 10) : Date.now() - st.mtimeMs;
      if (idade > SETE_DIAS_MS) {
        bytes += st.size;
        fs.unlinkSync(path.join(full, f));
        removidos++;
      }
    }
  }

  if (removidos === 0) {
    console.log('Nada a limpar.');
    fs.rmSync(PAGES_DIR, { recursive: true, force: true });
    return;
  }

  git('git config user.email "bot@bomdiainvestidor.com.br"', PAGES_DIR);
  git('git config user.name "Bom Dia Investidor Bot"', PAGES_DIR);
  git('git add -A bdi-cards bdi-tiktok', PAGES_DIR);
  git(`git commit -m "Limpeza automatica: ${removidos} midias com mais de 7 dias (${(bytes / 1048576).toFixed(0)} MB)"`, PAGES_DIR);
  git('git push', PAGES_DIR);

  console.log(`Removidos ${removidos} arquivos (${(bytes / 1048576).toFixed(0)} MB).`);
  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
}

main();
