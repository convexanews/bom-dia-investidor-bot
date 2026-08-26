const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, spawnSync } = require('child_process');
const { buscarNoticiasRadar: buscarNoticias, titulosSimilares, corrigirTextoEditorial } = require('./radar_noticias.cjs');
const { buscarConteudoArtigo } = require('./imagem_noticia.cjs');
const { startPublication, ffmpegPath, safeError } = require('./studio-publisher.cjs');
const { gerarNarracao, chaveNarracao, VOZES_STUDIO, estimarDuracaoNarracao } = require('./studio-audio.cjs');
const { lerAgenda, agendar, atualizarAgendamento, agendamentosVencidos } = require('./studio-agenda.cjs');
const { MAX_IMAGE_BYTES, readCachedMedia, saveCachedMedia } = require('./studio-media-cache.cjs');

const ROOT = __dirname;
const PORT = Math.max(1, Number(process.env.STUDIO_PORT) || 4310);
const HOST = '127.0.0.1';
const QUEUE_ROOT = path.join(ROOT,'rascunhos-studio');
const NEWS_CACHE = path.join(ROOT,'noticias-studio.json');
const PROJECTS_ROOT = path.join(ROOT,'projetos-studio');
const CACHE_ROOT = path.join(ROOT,'studio-cache');
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm' };

function responder(res,status,body,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(body);
}

function loadJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function localOriginAllowed(req){const origin=req.headers.origin;return !origin||/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)}
function newsCache(){const cache=loadJson(NEWS_CACHE,{updatedAt:null,items:[],warning:null});cache.items=(cache.items||[]).map(item=>({...item,titulo:corrigirTextoEditorial(item.titulo),descricao:corrigirTextoEditorial(item.descricao)}));return cache}
let newsRefreshPromise=null;
async function refreshNews(){
  if(newsRefreshPromise)return newsRefreshPromise;
  newsRefreshPromise=(async()=>{
    const previous=new Map(newsCache().items.map(item=>[item.link,item]));
    const postedUrls=new Set(loadJson(path.join(ROOT,'noticias-postadas.json'),[]));
    const report=loadJson(path.join(ROOT,'relatorio.json'),[]),reportTitles=report.map(item=>item.titulo).filter(Boolean);
    const collected=await buscarNoticias(120);
    if(!collected.length){const cached=newsCache();return {...cached,warning:'Nenhuma fonte respondeu agora. Exibindo o último resultado salvo.'}}
    const items=collected.map(item=>({...item,jaPublicada:postedUrls.has(item.link)||report.some(post=>post.link===item.link)||reportTitles.some(title=>titulosSimilares(title,item.titulo)),usadaNoStudio:Boolean(previous.get(item.link)?.usadaNoStudio),usadaEm:previous.get(item.link)?.usadaEm||null}));
    const data={updatedAt:new Date().toISOString(),items,warning:null},temp=`${NEWS_CACHE}.tmp`;fs.writeFileSync(temp,JSON.stringify(data,null,2));fs.renameSync(temp,NEWS_CACHE);return data;
  })().finally(()=>{newsRefreshPromise=null});return newsRefreshPromise;
}

async function markNewsUsed(req,res){
  if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);
  try{const body=await readJson(req,32*1024),cache=newsCache(),item=cache.items.find(news=>news.link===body.link);if(!item)throw new Error('Notícia não encontrada no radar');item.usadaNoStudio=true;item.usadaEm=new Date().toISOString();fs.writeFileSync(NEWS_CACHE,JSON.stringify(cache,null,2));responder(res,200,JSON.stringify({ok:true}),MIME['.json'])}catch(error){responder(res,400,JSON.stringify({error:error.message}),MIME['.json'])}
}

function queueItems(){
  if(!fs.existsSync(QUEUE_ROOT))return [];
  const scheduleById=new Map(lerAgenda().map(item=>[item.queueId,item]));
  return fs.readdirSync(QUEUE_ROOT,{withFileTypes:true}).filter(item=>item.isDirectory()).sort((a,b)=>b.name.localeCompare(a.name)).map(item=>{
    const metaFile=path.join(QUEUE_ROOT,item.name,'projeto.json');
    if(!fs.existsSync(metaFile))return null;
    try{const data=JSON.parse(fs.readFileSync(metaFile,'utf8'));return {id:item.name,title:data.project?.slides?.[0]?.headline||'Post sem título',format:data.project?.format||'feed',createdAt:data.createdAt,cover:`/rascunhos-studio/${item.name}/slide-1.png`,hasVideo:Boolean(data.video),video:data.video?`/rascunhos-studio/${item.name}/${data.video}`:null,status:data.status||'fila-local',approvedAt:data.approvedAt||null,publishedAt:data.publishedAt||null,instagramPostId:data.instagramPostId||null,publicationRunUrl:data.publicationRunUrl||null,publicationError:data.publicationError||null,scheduledAt:scheduleById.get(item.name)?.scheduledAt||data.scheduledAt||null,scheduleStatus:scheduleById.get(item.name)?.status||null}}catch{return null}
  }).filter(Boolean);
}

function queueProject(res,id){
  if(!/^\d{17}$/.test(id))return responder(res,400,JSON.stringify({error:'Identificador inválido'}),MIME['.json']);
  const metaFile=path.join(QUEUE_ROOT,id,'projeto.json');if(!fs.existsSync(metaFile))return responder(res,404,JSON.stringify({error:'Projeto não encontrado'}),MIME['.json']);
  const meta=loadJson(metaFile,null);if(!meta)return responder(res,400,JSON.stringify({error:'Projeto inválido'}),MIME['.json']);
  responder(res,200,JSON.stringify({id,project:meta.project,caption:meta.caption||'',status:meta.status||'fila-local',hasVideo:Boolean(meta.video),videoType:meta.videoType||null,scheduledAt:meta.scheduledAt||null}),MIME['.json']);
}

function readJson(req,limit=45*1024*1024){
  return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>limit){reject(new Error('Arquivo muito grande para a fila local'));req.destroy();return}chunks.push(chunk)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(new Error('Dados inválidos'))}});req.on('error',reject)});
}

function commandAvailable(command,args=['--version']){
  try{return spawnSync(command,args,{windowsHide:true,timeout:5000,stdio:'ignore'}).status===0}catch{return false}
}

function githubAuthenticated(){
  try{return spawnSync('gh',['api','user','--jq','.login'],{windowsHide:true,timeout:10000,encoding:'utf8'}).status===0}catch{return false}
}

function healthData(){
  let ttsInstalled=false;try{require.resolve('node-edge-tts');ttsInstalled=true}catch{}
  const ffmpeg=ffmpegPath();
  return {
    ok:true,version:'2.0',serverTime:new Date().toISOString(),port:PORT,
    capabilities:{
      github:githubAuthenticated(),ffmpeg:commandAvailable(ffmpeg,['-version']),tts:ttsInstalled,
      instagramMirror:fs.existsSync(path.join(ROOT,'instagram-studio.json')),
    },
    queue:queueItems().length,news:newsCache().items.length,scheduled:lerAgenda().filter(item=>item.status==='agendado').length,
  };
}

async function createNarration(req,res){
  if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);
  try{
    const body=await readJson(req,32*1024),key=chaveNarracao({texto:body.text,voice:body.voice,rate:body.rate,pitch:body.pitch,volume:body.volume});
    const narrationCache=path.join(CACHE_ROOT,'narration');fs.mkdirSync(narrationCache,{recursive:true});
    const output=path.join(narrationCache,`${key}.mp3`);
    const result=await gerarNarracao({texto:body.text,voice:body.voice,rate:body.rate,pitch:body.pitch,volume:body.volume,saida:output});
    const bytes=fs.readFileSync(output);
    res.writeHead(200,{'content-type':'audio/mpeg','content-length':bytes.length,'cache-control':'private, max-age=86400','x-narration-cache':result.cache?'hit':'miss','x-narration-seconds':String(estimarDuracaoNarracao(result.roteiro)),'x-content-type-options':'nosniff'});res.end(bytes);
  }catch(error){responder(res,503,JSON.stringify({error:error.message||'O serviço de voz neural não respondeu.'}),MIME['.json'])}
}

let instagramCache={at:0,data:null};
async function instagramMirror(){
  if(instagramCache.data&&Date.now()-instagramCache.at<120000)return instagramCache.data;
  try{
    const response=await fetch(`https://raw.githubusercontent.com/convexanews/bom-dia-investidor-bot/main/instagram-studio.json?t=${Date.now()}`,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();instagramCache={at:Date.now(),data};return data;
  }catch{
    return loadJson(path.join(ROOT,'instagram-studio.json'),{updatedAt:null,items:[],warning:'Espelho ainda não sincronizado.'});
  }
}

function triggerInstagramSync(req,res){
  if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);
  if(!githubAuthenticated())return responder(res,401,JSON.stringify({error:'GitHub desconectado. Reconecte a conta convexanews pelo GitHub CLI e tente novamente.'}),MIME['.json']);
  execFile('gh',['workflow','run','studio-sync-instagram.yml','--repo','convexanews/bom-dia-investidor-bot'],{windowsHide:true,timeout:30000},(error,_stdout,stderr)=>{
    if(error)return responder(res,502,JSON.stringify({error:safeError({message:error.message,stderr})}),MIME['.json']);
    instagramCache={at:0,data:null};responder(res,202,JSON.stringify({ok:true,status:'sincronizando'}),MIME['.json']);
  });
}

async function scheduleQueueItem(req,res){
  if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);
  try{
    const body=await readJson(req,16*1024),metaFile=path.join(QUEUE_ROOT,String(body.queueId||''),'projeto.json'),meta=loadJson(metaFile,null);
    if(!meta)throw new Error('Projeto da fila não encontrado.');
    if(meta.status!=='aprovado-local')throw new Error('Aprove o projeto antes de agendar.');
    const item=agendar(body);meta.scheduledAt=item.scheduledAt;fs.writeFileSync(metaFile,JSON.stringify(meta,null,2));
    responder(res,201,JSON.stringify(item),MIME['.json']);
  }catch(error){responder(res,400,JSON.stringify({error:error.message}),MIME['.json'])}
}

function processScheduled(){
  for(const item of agendamentosVencidos()){
    const folder=path.join(QUEUE_ROOT,item.queueId),metaFile=path.join(folder,'projeto.json'),meta=loadJson(metaFile,null);
    if(!meta||meta.status!=='aprovado-local'){atualizarAgendamento(item.queueId,{status:'erro',error:'Projeto não está aprovado.'});continue}
    if(startPublication({id:item.queueId,folder,metaFile}))atualizarAgendamento(item.queueId,{status:'enviado'});
  }
}

async function saveToQueue(req,res){
  if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);
  try{
    const body=await readJson(req);
    if(!body?.project||!Array.isArray(body.images)||!body.images.length||body.images.length>20)throw new Error('Projeto ou slides inválidos');
    const id=new Date().toISOString().replace(/\D/g,'');
    const folder=path.join(QUEUE_ROOT,id);fs.mkdirSync(folder,{recursive:true});
    body.images.forEach((image,index)=>{const match=/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(image);if(!match)throw new Error(`Imagem ${index+1} inválida`);fs.writeFileSync(path.join(folder,`slide-${index+1}.png`),Buffer.from(match[1],'base64'))});
    const saved={createdAt:new Date().toISOString(),status:'fila-local',caption:String(body.caption||'').slice(0,2200),project:body.project};
    fs.writeFileSync(path.join(folder,'projeto.json'),JSON.stringify(saved,null,2));fs.writeFileSync(path.join(folder,'legenda.txt'),saved.caption);
    responder(res,201,JSON.stringify({ok:true,id,status:'fila-local'}),MIME['.json']);
  }catch(error){responder(res,400,JSON.stringify({error:error.message}),MIME['.json'])}
}

function saveQueueVideo(req,res,id){
  if(!/^\d{17}$/.test(id))return responder(res,400,JSON.stringify({error:'Identificador inválido'}),MIME['.json']);
  const folder=path.join(QUEUE_ROOT,id),metaFile=path.join(folder,'projeto.json');if(!fs.existsSync(metaFile))return responder(res,404,JSON.stringify({error:'Projeto não encontrado'}),MIME['.json']);
  const type=String(req.headers['content-type']||'').split(';')[0],extension=type==='video/mp4'?'mp4':type==='video/webm'?'webm':'';if(!extension)return responder(res,415,JSON.stringify({error:'Formato de vídeo não aceito'}),MIME['.json']);
  const limit=180*1024*1024,temp=path.join(folder,`reel.${extension}.tmp`),final=path.join(folder,`reel.${extension}`),stream=fs.createWriteStream(temp,{flags:'wx'});let size=0,failed=false;
  const fail=message=>{if(failed)return;failed=true;stream.destroy();if(fs.existsSync(temp))fs.rmSync(temp,{force:true});responder(res,400,JSON.stringify({error:message}),MIME['.json'])};
  req.on('data',chunk=>{size+=chunk.length;if(size>limit){fail('Vídeo maior que 180 MB');req.destroy()}});req.on('error',()=>fail('Falha ao receber o vídeo'));stream.on('error',()=>fail('Falha ao salvar o vídeo'));
  stream.on('finish',()=>{if(failed)return;fs.renameSync(temp,final);const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));meta.video=`reel.${extension}`;meta.videoType=type;meta.videoBytes=size;fs.writeFileSync(metaFile,JSON.stringify(meta,null,2));responder(res,201,JSON.stringify({ok:true,video:meta.video}),MIME['.json'])});req.pipe(stream);
}

function knownArticleLink(link){
  if(newsCache().items.some(item=>item.link===link))return true;
  if(!fs.existsSync(PROJECTS_ROOT))return false;
  return fs.readdirSync(PROJECTS_ROOT).filter(file=>/^[a-z0-9-]+\.json$/i.test(file)).some(file=>loadJson(path.join(PROJECTS_ROOT,file),{}).originNews?.link===link);
}

const articleMediaCache=new Map();
async function serveArticleMedia(res,link,index){
  if(!knownArticleLink(link))return responder(res,403,'Matéria fora do Radar');
  const cached=readCachedMedia(CACHE_ROOT,link,index);if(cached){res.writeHead(200,{'content-type':cached.type,'cache-control':'private, max-age=86400','x-content-type-options':'nosniff','x-bdi-media-cache':'hit'});return res.end(cached.bytes)}
  try{
    let materia={imagens:[]},erroArtigo=null;if(!articleMediaCache.has(link))articleMediaCache.set(link,buscarConteudoArtigo(link));try{materia=await articleMediaCache.get(link)}catch(error){erroArtigo=error;articleMediaCache.delete(link)}
    const itemRadar=newsCache().items.find(item=>item.link===link),imagens=[...(materia.imagens||[]),itemRadar?.imagem].filter(Boolean).filter((url,pos,list)=>list.indexOf(url)===pos);if(!imagens.length)throw erroArtigo||new Error('A matéria não forneceu imagem editorial');
    const inicio=Math.max(0,index)%imagens.length;let ultimoErro=null;
    for(let tentativa=0;tentativa<imagens.length;tentativa++)try{const imageUrl=imagens[(inicio+tentativa)%imagens.length],response=await fetch(imageUrl,{headers:{'user-agent':'Mozilla/5.0 BDI-Studio/1.0','accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8','referer':new URL(link).origin},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const type=String(response.headers.get('content-type')||'').split(';')[0];if(!type.startsWith('image/'))throw new Error('Conteúdo recebido não é imagem');const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw new Error('Tamanho de imagem inválido');saveCachedMedia(CACHE_ROOT,link,index,type,bytes);res.writeHead(200,{'content-type':type,'cache-control':'private, max-age=86400','x-content-type-options':'nosniff','x-bdi-media-cache':'miss'});return res.end(bytes)}catch(error){ultimoErro=error}
    throw ultimoErro||new Error('Imagem indisponível');
  }catch(error){articleMediaCache.delete(link);responder(res,502,`Não foi possível carregar a imagem: ${error.message}`)}
}

async function serveArticleContent(res,link){
  if(!knownArticleLink(link))return responder(res,403,JSON.stringify({error:'Matéria fora do Radar'}),MIME['.json']);
  try{
    if(!articleMediaCache.has(link))articleMediaCache.set(link,buscarConteudoArtigo(link));
    const materia=await articleMediaCache.get(link);
    if(!materia.texto||!materia.blocos?.length)throw new Error('A página não forneceu texto editorial suficiente');
    responder(res,200,JSON.stringify({texto:materia.texto.slice(0,8000),blocos:materia.blocos,imagens:materia.imagens?.length||0}),MIME['.json']);
  }catch(error){articleMediaCache.delete(link);responder(res,502,JSON.stringify({error:`Não foi possível ler a matéria completa: ${error.message}`}),MIME['.json'])}
}

function approveQueueItem(req,res,id){
  if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);
  if(!/^\d{17}$/.test(id))return responder(res,400,JSON.stringify({error:'Identificador inválido'}),MIME['.json']);
  const metaFile=path.join(QUEUE_ROOT,id,'projeto.json');if(!fs.existsSync(metaFile))return responder(res,404,JSON.stringify({error:'Projeto não encontrado'}),MIME['.json']);
  try{const meta=loadJson(metaFile,null);if(!meta)throw new Error('Projeto inválido');if(meta.project?.format==='reel'&&!meta.video)throw new Error('Gere e salve o vídeo antes de aprovar');meta.status='aprovado-local';meta.approvedAt=new Date().toISOString();fs.writeFileSync(metaFile,JSON.stringify(meta,null,2));responder(res,200,JSON.stringify({ok:true,status:meta.status,approvedAt:meta.approvedAt}),MIME['.json'])}catch(error){responder(res,400,JSON.stringify({error:error.message}),MIME['.json'])}
}

function publishQueueItem(req,res,id){
  if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);
  if(!/^\d{17}$/.test(id))return responder(res,400,JSON.stringify({error:'Identificador inválido'}),MIME['.json']);
  const folder=path.join(QUEUE_ROOT,id),metaFile=path.join(folder,'projeto.json');if(!fs.existsSync(metaFile))return responder(res,404,JSON.stringify({error:'Projeto não encontrado'}),MIME['.json']);
  try{const meta=loadJson(metaFile,null);if(!meta)throw new Error('Projeto inválido');const format=meta.project?.format||'feed';if(!['feed','story','carousel','reel'].includes(format))throw new Error('Formato não publicável');if(format==='reel'&&(!meta.video||!fs.existsSync(path.join(folder,meta.video))))throw new Error('O vídeo ainda não foi anexado à fila');if(meta.status==='publicado')throw new Error('Esta criação já foi publicada');if(!['aprovado-local','erro-publicacao'].includes(meta.status))throw new Error('Aprove a criação antes de publicar');if(!startPublication({id,folder,metaFile}))throw new Error('A publicação desta criação já está em andamento');responder(res,202,JSON.stringify({ok:true,status:'enviando-midia'}),MIME['.json'])}catch(error){responder(res,400,JSON.stringify({error:error.message}),MIME['.json'])}
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||HOST}`);
    if(url.pathname==='/api/posts'){
      const file=path.join(ROOT,'relatorio.json');
      return responder(res,200,fs.existsSync(file)?fs.readFileSync(file):'[]',MIME['.json']);
    }
    if(url.pathname==='/api/health'&&req.method==='GET')return responder(res,200,JSON.stringify(healthData()),MIME['.json']);
    if(url.pathname==='/api/voices'&&req.method==='GET')return responder(res,200,JSON.stringify(VOZES_STUDIO),MIME['.json']);
    if(url.pathname==='/api/narration'&&req.method==='POST')return createNarration(req,res);
    if(url.pathname==='/api/instagram'&&req.method==='GET')return responder(res,200,JSON.stringify(await instagramMirror()),MIME['.json']);
    if(url.pathname==='/api/instagram/refresh'&&req.method==='POST')return triggerInstagramSync(req,res);
    if(url.pathname==='/api/metrics'&&req.method==='GET')return responder(res,200,JSON.stringify({summary:loadJson(path.join(ROOT,'metricas-resumo.json'),{}),items:loadJson(path.join(ROOT,'metricas.json'),[])}),MIME['.json']);
    if(url.pathname==='/api/calendar'&&req.method==='GET')return responder(res,200,JSON.stringify(lerAgenda()),MIME['.json']);
    if(url.pathname==='/api/calendar'&&req.method==='POST')return scheduleQueueItem(req,res);
    if(url.pathname==='/api/news'&&req.method==='GET')return responder(res,200,JSON.stringify(newsCache()),MIME['.json']);
    if(url.pathname==='/api/news/refresh'&&req.method==='POST'){if(!localOriginAllowed(req))return responder(res,403,JSON.stringify({error:'Origem não autorizada'}),MIME['.json']);try{return responder(res,200,JSON.stringify(await refreshNews()),MIME['.json'])}catch(error){return responder(res,502,JSON.stringify({error:error.message}),MIME['.json'])}}
    if(url.pathname==='/api/news/mark'&&req.method==='POST')return markNewsUsed(req,res);
    if(url.pathname==='/api/news/article'&&req.method==='GET')return serveArticleContent(res,url.searchParams.get('link')||'');
    if(url.pathname==='/api/news/media'&&req.method==='GET')return serveArticleMedia(res,url.searchParams.get('link')||'',Number(url.searchParams.get('index'))||0);
    if(url.pathname==='/api/queue'&&req.method==='GET')return responder(res,200,JSON.stringify(queueItems()),MIME['.json']);
    if(url.pathname==='/api/queue'&&req.method==='POST')return saveToQueue(req,res);
    const projectRoute=/^\/api\/queue\/(\d{17})\/project$/.exec(url.pathname);if(projectRoute&&req.method==='GET')return queueProject(res,projectRoute[1]);
    const videoRoute=/^\/api\/queue\/(\d{17})\/video$/.exec(url.pathname);if(videoRoute&&req.method==='POST')return saveQueueVideo(req,res,videoRoute[1]);
    const approveRoute=/^\/api\/queue\/(\d{17})\/approve$/.exec(url.pathname);if(approveRoute&&req.method==='POST')return approveQueueItem(req,res,approveRoute[1]);
    const publishRoute=/^\/api\/queue\/(\d{17})\/publish$/.exec(url.pathname);if(publishRoute&&req.method==='POST')return publishQueueItem(req,res,publishRoute[1]);
    if(url.pathname==='/'){
      res.writeHead(302,{location:'/painel/'});return res.end();
    }
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'painel/index.html';
    let file=path.resolve(ROOT,relative);
    if(!file.startsWith(ROOT+path.sep))return responder(res,403,'Acesso negado');
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return responder(res,404,'Não encontrado');
    responder(res,200,fs.readFileSync(file),MIME[path.extname(file).toLowerCase()]||'application/octet-stream');
  }catch(erro){responder(res,500,erro.message)}
});

server.listen(PORT,HOST,()=>console.log(`BDI Studio: http://${HOST}:${PORT}/painel/`));
const scheduleTimer=setInterval(processScheduled,30000);scheduleTimer.unref();
