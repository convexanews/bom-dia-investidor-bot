# Bom Dia Investidor — Bot Automático

Repositório **privado** que roda no GitHub Actions (sem precisar do PC ligado) e publica
automaticamente no Instagram @bomdia_investidor, com seleção editorial, formatos variados
e limite de frequência para preservar qualidade e alcance.

## Como funciona

1. A cada duas horas, das 06h às 22h BRT (`.github/workflows/auto-post.yml`), o Actions roda `auto-post.cjs`
2. Busca e aprova notícias relevantes via `coletor_noticias.cjs` e `politica_editorial.cjs`
3. Se a notícia ainda não foi postada (`noticias-postadas.json`), gera o card (feed 4:5 e
   story 9:16) com `gerar_card_noticia.cjs`
4. Publica as imagens no repositório público `convexanews/convexanews.github.io` (pasta
   `bdi-cards/`), para ter uma URL pública que o Instagram consiga acessar
5. Publica no Instagram (Feed + Stories) via Graph API
6. Registra o resultado em `relatorio.json` (histórico de postagens automáticas)

## Qualidade e crescimento

- Nove Reels automáticos por dia, entre 06h e 22h BRT, com intervalo mínimo de duas horas. Os ciclos agendados usam o estoque de notícias das últimas 24 horas e aceitam pautas de peso 50 ou maior, sem dispensar fonte, contexto, política editorial e deduplicação.
- Conteúdo fora dos pilares editoriais (macro, bolsa, renda fixa, FIIs, cripto e exterior)
  é descartado antes da publicação.
- As legendas incluem contexto, um CTA e aviso de conteúdo informativo.
- `coletar_metricas.cjs` registra alcance, salvamentos, compartilhamentos e indicadores
  disponíveis da API para comparar formatos e temas.
- A política de pauta, cadência e interpretação de métricas está em `ESTRATEGIA_EDITORIAL.md`.

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

## BDI Studio 2.0 (local)

O Studio é o ambiente de criação e revisão manual do projeto. Ele permite montar posts,
Stories, carrosséis e Reels sem publicar automaticamente. Para preparar a máquina na
primeira utilização, execute `preparar-studio.cmd`; depois, abra `abrir-studio.cmd`.

Principais recursos:

- editor visual com prévia do perfil, modelos, cenas, duração e linha do tempo;
- importação de notícias do radar com roteiro contextualizado e crédito da fonte;
- Reels 9:16 com imagens por cena, música autorizada e narração neural em português;
- mixagem independente da voz e da música;
- conversão final para MP4 H.264/AAC, 1080 × 1920 e áudio em 48 kHz;
- espelho das publicações reais do Instagram e resumo local de métricas;
- fila com revisão, aprovação, segunda confirmação e calendário editorial;
- deduplicação compartilhada: uma notícia publicada pelo Studio entra no mesmo histórico
  usado pelo bot online, evitando que a automação publique a mesma pauta novamente.

O agendamento local só é executado enquanto o Studio estiver aberto. A sincronização do
Instagram e a publicação usam GitHub Actions e dependem dos mesmos secrets descritos
acima. Nenhuma mídia é enviada ao Instagram apenas por abrir ou editar um projeto.

## Reel-resumo diário

Uma vez por dia (`.github/workflows/daily-reel.yml`, `auto-reel.cjs`), o bot:

1. Pega as notícias postadas nas últimas 24h em `relatorio.json`
2. Monta um vídeo (Reel 9:16) juntando os cards de story de cada notícia, 3 segundos
   cada, usando `ffmpeg` (`gerar_reel.cjs`)
3. Sobe o vídeo para `convexanews/convexanews.github.io` (pasta `bdi-cards/`)
4. Publica como Reel no Instagram, com legenda listando as manchetes do dia
5. Se não houver nenhuma notícia postada nas últimas 24h, não gera reel
