# Sistema de qualidade para carrosséis

## Quando usar

Carrossel de notícia entra no feed quando a pauta tiver relevância editorial (peso 70–84), fonte identificável e consequência real para o investidor. Pautas excepcionais (peso 85+) viram Reel. Conteúdo educativo pode ser produzido manualmente, mas não deve ocupar o lugar de uma notícia relevante.

## Narrativa de seis imagens

1. **Capa:** uma tese verificável e curta; não uma manchete genérica.
2. **O fato:** o número, decisão ou mudança que sustenta a capa.
3. **O mecanismo:** por que isso aconteceu.
4. **A consequência:** o que muda para mercado, juros, bolsa, crédito ou carteira.
5. **O próximo sinal:** qual dado, decisão ou risco acompanhar.
6. **CTA:** salvar/compartilhar com utilidade, sem recomendar compra ou venda.

## Regra visual

- Uma ideia por slide; título de leitura rápida e texto de apoio curto.
- O dado-chave é o elemento de maior contraste; imagens e gráficos devem provar o ponto, não servir de enfeite.
- Use contraste e hierarquia visual para guiar o olhar, mas não use medo artificial, promessas ou frases de certeza.
- A capa abre uma curiosidade legítima; o slide seguinte entrega a prova imediatamente.

## Portão de publicação

`qualidade_carrossel.cjs` calcula a nota e bloqueia automaticamente pauta com impacto insuficiente, contexto raso, falta de fonte ou promessa financeira. A nota mínima é 75/100.
