const $ = id => document.getElementById(id);
const fields = ['storyCategory','storyHeadline','storyBody','storySource','storyCta','storyCredit','storyColorA','storyColorB','storyAccent','storyCaption'];
const defaults = () => ({
  category:'Mercado agora', headline:'O mercado recebeu um novo sinal importante',
  body:'Entenda o que aconteceu e o que o investidor deve acompanhar nas próximas horas.',
  source:'Bom Dia Investidor', credit:'Imagem editorial: Bom Dia Investidor', cta:'Veja a análise →',
  colorA:'#071d18', colorB:'#0c4b38', accent:'#d9aa43', image:'', imageIndex:0, originNews:null, caption:''
});
let state = defaults(), lastQueuedId = null, poll = null, renderToken = 0;

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2500)}
function clean(value,max){return String(value||'').replace(/\s+/g,' ').trim().slice(0,max)}
function editorial(value){return String(value||'').replace(/\bvolatileve\b/gi,'volatilidade').replace(/\s+The post[\s\S]*?appeared first on\s+[^.]+\.?/gi,'').trim()}
function articleImage(link,index=0){return link?`/api/news/media?link=${encodeURIComponent(link)}&index=${index}`:''}
function syncState(){
  state.category=$('storyCategory').value;state.headline=$('storyHeadline').value;state.body=$('storyBody').value;
  state.source=$('storySource').value;state.cta=$('storyCta').value;state.credit=$('storyCredit').value;
  state.colorA=$('storyColorA').value;state.colorB=$('storyColorB').value;state.accent=$('storyAccent').value;state.caption=$('storyCaption').value;
  localStorage.setItem('bdi-story-draft',JSON.stringify(state));
}
function syncFields(){
  $('storyCategory').value=state.category;$('storyHeadline').value=state.headline;$('storyBody').value=state.body;
  $('storySource').value=state.source;$('storyCta').value=state.cta;$('storyCredit').value=state.credit;
  $('storyColorA').value=state.colorA;$('storyColorB').value=state.colorB;$('storyAccent').value=state.accent;$('storyCaption').value=state.caption||'';
  $('storyImageActions').classList.toggle('hidden',!state.originNews?.link);
  $('storyImageName').textContent=state.image?(state.originNews?.link?`Imagem editorial ${state.imageIndex+1}`:'Imagem personalizada'):'Escolher imagem';
  if(state.originNews){$('storyOrigin').querySelector('b').textContent=clean(state.originNews.source,60);$('storyOrigin').querySelector('span').textContent=clean(state.originNews.title,170)}
}
function resetApproval(){
  if(!lastQueuedId)return;lastQueuedId=null;clearInterval(poll);$('approveStory').disabled=true;$('publishStory').disabled=true;
  $('approveStory').textContent='2. Aprovar Story';$('publishStory').textContent='3. Publicar no Instagram';$('storyStatusBadge').textContent='editado';
  $('storyPublicationStatus').textContent='O Story foi alterado. Envie novamente à fila para publicar esta versão.';
}
function wrap(ctx,text,x,y,maxWidth,lineHeight,maxLines){
  const words=clean(text,500).split(' ').filter(Boolean),lines=[];let line='';
  for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width<=maxWidth)line=test;else{if(line)lines.push(line);line=word;if(lines.length===maxLines)break}}
  if(line&&lines.length<maxLines)lines.push(line);if(words.length&&lines.length===maxLines){while(ctx.measureText(`${lines[maxLines-1]}…`).width>maxWidth)lines[maxLines-1]=lines[maxLines-1].slice(0,-1);lines[maxLines-1]+='…'}
  lines.forEach((value,index)=>ctx.fillText(value,x,y+index*lineHeight));return y+lines.length*lineHeight;
}
function loadImage(src){return new Promise(resolve=>{if(!src)return resolve(null);const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src})}
async function draw(){
  const token=++renderToken,canvas=$('storyCanvas'),ctx=canvas.getContext('2d'),W=1080,H=1920;
  const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,state.colorA);gradient.addColorStop(1,state.colorB);ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
  const image=await loadImage(state.image);if(token!==renderToken)return;
  if(image){const scale=Math.max(W/image.naturalWidth,H/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;ctx.drawImage(image,(W-width)/2,(H-height)/2,width,height)}
  const shade=ctx.createLinearGradient(0,120,H*.15,H);shade.addColorStop(0,'rgba(0,0,0,.08)');shade.addColorStop(.42,'rgba(0,0,0,.18)');shade.addColorStop(.72,'rgba(0,0,0,.76)');shade.addColorStop(1,'rgba(0,0,0,.94)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=state.accent;ctx.beginPath();ctx.roundRect(72,170,Math.min(450,clean(state.category,28).length*18+90),60,30);ctx.fill();ctx.fillStyle='#10130f';ctx.font='900 25px Arial';ctx.textBaseline='top';ctx.fillText(clean(state.category,28).toUpperCase(),105,188);
  if(state.credit){ctx.fillStyle='rgba(0,0,0,.62)';ctx.beginPath();ctx.roundRect(72,250,Math.min(720,clean(state.credit,80).length*13+45),42,8);ctx.fill();ctx.fillStyle='#e8ecef';ctx.font='600 18px Arial';ctx.fillText(clean(state.credit,80),92,262)}
  let y=1050;ctx.fillStyle='#fff';ctx.font='900 72px Arial';y=wrap(ctx,state.headline,72,y,936,76,5)+24;
  ctx.fillStyle='#e3e8e6';ctx.font='400 31px Arial';y=wrap(ctx,state.body,72,y,930,43,4)+38;
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(72,y);ctx.lineTo(1008,y);ctx.stroke();
  ctx.font='800 23px Arial';ctx.fillStyle='#fff';ctx.fillText(`Fonte: ${clean(state.source,60)}`,72,y+28);ctx.fillStyle=state.accent;ctx.textAlign='right';ctx.fillText(clean(state.cta,45),1008,y+28);ctx.textAlign='left';
}
function importSeed(){
  let seed=null;try{seed=JSON.parse(localStorage.getItem('bdi-story-seed')||'null')}catch{}
  if(seed?.item){localStorage.removeItem('bdi-story-seed');const news=seed.item,source=clean(news.fonte||'Fonte original',60);state={...defaults(),category:clean((news.pilares?.[0]||'Mercado agora').replace(/^./,x=>x.toUpperCase()),28),headline:clean(editorial(news.titulo),130),body:clean(editorial(news.descricao||'Consulte a matéria original para entender o contexto completo.'),230),source,credit:`Imagem editorial: ${source}`,cta:'Confira no perfil →',image:articleImage(news.link,0),imageIndex:0,originNews:{title:editorial(news.titulo),link:news.link,source},caption:`Fonte: ${source}\n${news.link||''}`};return}
  try{const draft=JSON.parse(localStorage.getItem('bdi-story-draft')||'null');if(draft)state={...defaults(),...draft,headline:editorial(draft.headline),body:editorial(draft.body)}}catch{}
}
async function queueStory(){
  syncState();if(!clean(state.headline,130))return toast('Escreva uma manchete');if(!clean(state.source,60))return toast('Informe a fonte');
  const button=$('queueStory');button.disabled=true;button.textContent='Preparando Story…';try{await draw();const project={format:'story',originNews:state.originNews,slides:[{category:state.category,headline:state.headline,body:state.body,source:`Fonte: ${state.source}`,imageCredit:state.credit,cta:state.cta,colorA:state.colorA,colorB:state.colorB,accent:state.accent,image:state.image}]};const response=await fetch('/api/queue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project,caption:state.caption,images:[$('storyCanvas').toDataURL('image/png')]})}),result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível salvar');lastQueuedId=result.id;$('approveStory').disabled=false;$('storyStatusBadge').textContent='na fila';$('storyPublicationStatus').textContent='Story salvo. Revise a imagem e clique em Aprovar Story.';toast('Story enviado à fila local')}catch(error){toast(error.message)}finally{button.disabled=false;button.textContent='1. Enviar à fila local'}
}
async function approveStory(){
  if(!lastQueuedId)return;if(!confirm('Aprovar este Story para liberar a publicação?'))return;const button=$('approveStory');button.disabled=true;try{const response=await fetch(`/api/queue/${lastQueuedId}/approve`,{method:'POST'}),result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível aprovar');button.textContent='✓ Story aprovado';$('publishStory').disabled=false;$('storyStatusBadge').textContent='aprovado';$('storyPublicationStatus').textContent='Aprovado. A publicação ainda exige uma confirmação final.';toast('Story aprovado')}catch(error){button.disabled=false;toast(error.message)}
}
async function pollPublication(){
  if(!lastQueuedId)return;try{const items=await (await fetch('/api/queue')).json(),item=items.find(entry=>entry.id===lastQueuedId);if(!item)return;if(item.status==='publicado'){clearInterval(poll);$('publishStory').disabled=true;$('publishStory').textContent='✓ Publicado nos Stories';$('publishStory').className='story-publish-button story-wide published';$('storyStatusBadge').textContent='publicado';$('storyPublicationStatus').textContent='Story publicado com sucesso no Instagram.';toast('Story publicado')}else if(item.status==='erro-publicacao'){clearInterval(poll);$('publishStory').disabled=false;$('publishStory').textContent='Tentar publicar novamente';$('publishStory').className='story-publish-button story-wide';$('storyPublicationStatus').textContent=item.publicationError||'A publicação falhou.'}else $('storyPublicationStatus').textContent='Enviando a imagem e aguardando o processamento do Instagram…'}catch{}
}
async function publishStory(){
  if(!lastQueuedId)return;if(!confirm('Publicar este Story agora no Instagram? Esta ação é real e ficará visível por 24 horas.'))return;const button=$('publishStory');button.disabled=true;button.textContent='Iniciando publicação…';button.classList.add('publishing');try{const response=await fetch(`/api/queue/${lastQueuedId}/publish`,{method:'POST'}),result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível iniciar');clearInterval(poll);poll=setInterval(pollPublication,3000);await pollPublication()}catch(error){button.disabled=false;button.textContent='3. Publicar no Instagram';button.classList.remove('publishing');toast(error.message)}
}
function changeEditorialImage(delta){if(!state.originNews?.link)return;state.imageIndex=Math.max(0,state.imageIndex+delta);state.image=articleImage(state.originNews.link,state.imageIndex);$('storyImageName').textContent=`Imagem editorial ${state.imageIndex+1}`;resetApproval();syncState();draw()}

fields.forEach(id=>$(id).addEventListener('input',()=>{syncState();resetApproval();draw()}));
$('storyImageUpload').onchange=event=>{const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>12*1024*1024)return toast('Escolha uma imagem de até 12 MB');const reader=new FileReader();reader.onload=()=>{state.image=reader.result;state.originNews=null;state.imageIndex=0;$('storyImageName').textContent=file.name;$('storyImageActions').classList.add('hidden');syncState();resetApproval();draw()};reader.readAsDataURL(file)};
$('previousImage').onclick=()=>changeEditorialImage(-1);$('nextImage').onclick=()=>changeEditorialImage(1);
$('queueStory').onclick=queueStory;$('approveStory').onclick=approveStory;$('publishStory').onclick=publishStory;
$('downloadStory').onclick=async()=>{syncState();await draw();const link=document.createElement('a');link.download=`bdi-story-${new Date().toISOString().slice(0,10)}.png`;link.href=$('storyCanvas').toDataURL('image/png');link.click();toast('Story baixado em PNG')};
$('newStory').onclick=()=>{if(!confirm('Começar um Story novo?'))return;state=defaults();lastQueuedId=null;localStorage.removeItem('bdi-story-draft');syncFields();resetApproval();$('approveStory').disabled=true;$('publishStory').disabled=true;$('storyStatusBadge').textContent='local';$('storyPublicationStatus').textContent='Nada será publicado sem aprovação e confirmação final.';draw()};

importSeed();syncFields();draw();
