// Helper git compartilhado pelos scripts do bot.
// O token NUNCA vai na linha de comando (vazaria em mensagem de erro e na
// lista de processos). O GIT_ASKPASS entrega a senha via env quando o git
// pede credencial — vale pro clone e pros pushes seguintes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

function criarAskpass() {
  const askpass = path.join(os.tmpdir(), 'bdi-askpass.sh');
  fs.writeFileSync(askpass, '#!/bin/sh\necho "$BDI_GIT_TOKEN"\n', { mode: 0o755 });
  return askpass;
}

function git(cmd, cwd) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (process.env.PAGES_TOKEN) {
    env.GIT_ASKPASS = criarAskpass();
    env.BDI_GIT_TOKEN = process.env.PAGES_TOKEN;
  }
  // Manchetes vêm de RSS externo. Para commits, nunca deixe esse texto passar pelo shell.
  const commit = cmd.match(/^git commit -m "([\s\S]*)"$/);
  if (commit) return execFileSync('git', ['commit', '-m', commit[1]], { cwd, stdio: 'inherit', env });
  execSync(cmd, { cwd, stdio: 'inherit', env });
}

module.exports = { git };
