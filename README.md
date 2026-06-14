# Bom Dia Investidor — Bot Automático

Repositório **privado** que roda no GitHub Actions (sem precisar do PC ligado) e publica
automaticamente no Instagram @bomdia_investidor, uma vez por hora, **somente se houver
notícia nova** do mercado financeiro (InfoMoney / Money Times).

## Como funciona

1. A cada hora (`.github/workflows/auto-post.yml`), o Actions roda `auto-post.cjs`
2. Busca notícias relevantes via `coletor_noticias.cjs`
3. Se a notícia ainda não foi postada (`noticias-postadas.json`), gera o card (feed 4:5 e
   story 9:16) com `gerar_card_noticia.cjs`
4. Publica as imagens no repositório público `convexanews/convexanews.github.io` (pasta
   `bdi-cards/`), para ter uma URL pública que o Instagram consiga acessar
5. Publica no Instagram (Feed + Stories) via Graph API
6. Registra o resultado em `relatorio.json` (histórico de postagens automáticas)

## Secrets necessários (Settings → Secrets and variables → Actions)

- `IG_TOKEN` — token de acesso do Instagram Graph API
- `IG_ACCOUNT_ID` — ID da conta do Instagram (@bomdia_investidor)
- `PAGES_TOKEN` — Personal Access Token (classic, escopo `repo`) com permissão de
  escrita no repositório `convexanews/convexanews.github.io`

## Relatório

`relatorio.json` guarda o histórico (data, manchete, fonte, link, IDs do post/story,
URLs das imagens). `verificacoes.json` guarda o resultado de cada verificação horária
(notícia nova encontrada / nenhuma notícia nova / erro). O painel local (`promo-bot`)
lê esses arquivos para mostrar o relatório de postagens automáticas em `/bdi-relatorio`.

## Reel-resumo diário

Uma vez por dia (`.github/workflows/daily-reel.yml`, `auto-reel.cjs`), o bot:

1. Pega as notícias postadas nas últimas 24h em `relatorio.json`
2. Monta um vídeo (Reel 9:16) juntando os cards de story de cada notícia, 3 segundos
   cada, usando `ffmpeg` (`gerar_reel.cjs`)
3. Sobe o vídeo para `convexanews/convexanews.github.io` (pasta `bdi-cards/`)
4. Publica como Reel no Instagram, com legenda listando as manchetes do dia
5. Se não houver nenhuma notícia postada nas últimas 24h, não gera reel
