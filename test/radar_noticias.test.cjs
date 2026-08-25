const test=require('node:test');
const assert=require('node:assert/strict');
const {parseItems,titulosSimilares,corrigirTextoEditorial}=require('../radar_noticias.cjs');

test('radar interpreta RSS financeiro sem dependências externas',()=>{
  const xml=`<rss><channel><item><title><![CDATA[Ibovespa sobe com decisão sobre juros]]></title><link>https://exemplo.com/mercado</link><pubDate>Thu, 20 Aug 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Bolsa reage à Selic e ao dólar.</p><img src="https://exemplo.com/capa.jpg">]]></description><category>Mercado</category></item></channel></rss>`;
  const items=parseItems(xml,{nome:'Fonte Teste'});
  assert.equal(items.length,1);assert.equal(items[0].fonte,'Fonte Teste');assert.equal(items[0].imagem,'https://exemplo.com/capa.jpg');assert.ok(items[0].peso>0);assert.ok(items[0].pilares.includes('bolsa'));
});

test('radar corrige ruído editorial antes de criar a arte',()=>{
  assert.equal(corrigirTextoEditorial('O dólar opera com volatileve alta nesta terça-feira.'),'O dólar opera com volatilidade alta nesta terça-feira.');
  assert.equal(corrigirTextoEditorial('Bolsa avança The post Bolsa avança appeared first on Portal.'),'Bolsa avança');
});

test('radar descarta assuntos não financeiros e reconhece títulos semelhantes',()=>{
  const xml='<rss><channel><item><title>Resultado da Mega-Sena</title><link>https://exemplo.com/loteria</link><description>Veja os números da loteria</description></item></channel></rss>';
  assert.equal(parseItems(xml,{nome:'Fonte Teste'}).length,0);
  assert.equal(titulosSimilares('Ibovespa sobe após decisão do Copom','Ibovespa sobe depois da decisão do Copom'),true);
});
