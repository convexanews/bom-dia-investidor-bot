/* Recursos progressivos do Studio 2.0. O editor original continua funcional sem este arquivo. */
(() => {
  const el = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
  let narrationUrl = '';

  function syncPublicationOptions() {
    state.publicationOptions = {
      ...(state.publicationOptions || {}),
      shareToFeed: el('shareToFeed')?.checked !== false,
      sceneCaptions: el('sceneCaptions')?.checked !== false,
    };
  }

  function narrationScript() {
    const parts = state.slides.map((slide, index) => {
      const opening = index === 0 ? '' : `${slide.category}. `;
      return `${opening}${slide.headline}. ${slide.body}`;
    });
    const source = state.originNews?.source || state.slides.at(-1)?.source;
    if (source) parts.push(`Fonte das informações: ${String(source).replace(/^Fonte das informações:\s*/i, '')}.`);
    parts.push('Conteúdo informativo. Não é recomendação de investimento.');
    return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 1800);
  }

  function renderTimelineV2() {
    const root = el('timelineTracks');
    if (!root || state.format !== 'reel') return;
    const total = state.slides.reduce((sum, slide) => sum + Number(slide.duration || 3), 0);
    el('timelineDuration').textContent = `${total.toLocaleString('pt-BR')}s`;
    root.innerHTML = state.slides.map((slide, index) => `
      <div class="timeline-track" data-timeline="${index}">
        <button type="button" data-move="up" title="Mover para cima">${index ? '↑' : '•'}</button>
        <div class="timeline-bar" style="flex:${Number(slide.duration || 3)}" title="${escapeHtml(slide.headline)}">${index + 1}. ${escapeHtml(slide.category)}</div>
        <input type="range" min="1" max="10" step=".5" value="${Number(slide.duration || 3)}" aria-label="Duração da cena ${index + 1}">
        <strong>${Number(slide.duration || 3).toLocaleString('pt-BR')}s</strong>
      </div>`).join('');
    root.querySelectorAll('.timeline-track').forEach(track => {
      const index = Number(track.dataset.timeline);
      track.querySelector('input').oninput = event => {
        state.slides[index].duration = Number(event.target.value);
        if (state.active === index) syncFields();
        render();
      };
      track.querySelector('[data-move]').onclick = () => {
        if (!index) return;
        [state.slides[index - 1], state.slides[index]] = [state.slides[index], state.slides[index - 1]];
        state.active = index - 1; syncFields(); render();
      };
    });
  }

  const originalRender = render;
  render = function renderStudioV2() {
    syncPublicationOptions();
    originalRender();
    renderTimelineV2();
  };

  el('buildNarration').onclick = () => {
    el('narrationText').value = narrationScript();
    el('narrationStatus').textContent = 'Roteiro montado com as cenas atuais. Revise e gere a voz.';
    toast('Roteiro de narração atualizado');
  };

  el('generateNarration').onclick = async () => {
    const button = el('generateNarration');
    if (!el('narrationText').value.trim()) el('narrationText').value = narrationScript();
    button.disabled = true; button.textContent = 'Gerando voz…';
    el('narrationStatus').textContent = 'Gerando narração neural em português…';
    try {
      const response = await fetch('/api/narration', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: el('narrationText').value, voice: el('narrationVoice').value, rate: el('narrationRate').value }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Falha ao gerar a narração.');
      const blob = await response.blob();
      narrationFile = new File([blob], 'narracao-bdi.mp3', { type: 'audio/mpeg' });
      if (narrationUrl) URL.revokeObjectURL(narrationUrl);
      narrationUrl = URL.createObjectURL(blob); el('narrationAudio').src = narrationUrl;
      el('previewNarration').disabled = false;
      const seconds = Number(response.headers.get('x-narration-seconds')) || 0;
      if (seconds && state.format === 'reel') {
        const perScene = Math.min(10, Math.max(2, Number((seconds / state.slides.length).toFixed(1))));
        state.slides.forEach(slide => { slide.duration = perScene; }); render();
      }
      el('narrationStatus').textContent = `Voz pronta${seconds ? ` • aproximadamente ${seconds}s` : ''}.`;
      toast('Narração adicionada ao Reel');
    } catch (error) { el('narrationStatus').textContent = error.message; toast(error.message); }
    finally { button.disabled = false; button.textContent = 'Gerar voz'; }
  };

  el('previewNarration').onclick = () => {
    const audio = el('narrationAudio');
    if (audio.paused) { audio.volume = Math.min(1, audioMixSettings.narrationVolume); audio.play(); el('previewNarration').textContent = '■ Parar'; }
    else { audio.pause(); audio.currentTime = 0; el('previewNarration').textContent = '▶ Ouvir'; }
  };
  el('narrationAudio').onended = () => { el('previewNarration').textContent = '▶ Ouvir'; };

  el('musicVolume').oninput = event => { audioMixSettings.musicVolume = Number(event.target.value) / 100; el('musicVolumeValue').textContent = `${event.target.value}%`; };
  el('voiceVolume').oninput = event => { audioMixSettings.narrationVolume = Number(event.target.value) / 100; el('voiceVolumeValue').textContent = `${event.target.value}%`; };
  el('shareToFeed').onchange = syncPublicationOptions;
  el('sceneCaptions').onchange = syncPublicationOptions;

  async function loadInstagramMirror() {
    const grid = el('instagramMirror'), status = el('instagramSyncStatus');
    try {
      const response = await fetch('/api/instagram');
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      status.textContent = data.updatedAt ? `Atualizado em ${new Date(data.updatedAt).toLocaleString('pt-BR')} • ${items.length} publicações` : 'O primeiro espelhamento ainda não foi executado.';
      grid.innerHTML = items.slice(0, 12).map(item => `<a class="feeditem" href="${escapeHtml(item.permalink)}" target="_blank" rel="noopener" title="Abrir publicação real"><img src="${escapeHtml(item.thumbnailUrl || item.mediaUrl)}" alt=""><em>${escapeHtml((item.productType || item.mediaType || 'post').toLowerCase())}</em></a>`).join('') || '<div class="empty">Ainda não há publicações sincronizadas.</div>';
    } catch { status.textContent = 'Não foi possível carregar o espelho do Instagram.'; grid.innerHTML = '<div class="empty">Espelho indisponível.</div>'; }
  }

  el('syncInstagram').onclick = async () => {
    const button = el('syncInstagram'); button.disabled = true; button.textContent = 'Sincronizando…';
    try {
      const response = await fetch('/api/instagram/refresh', { method: 'POST' });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      el('instagramSyncStatus').textContent = 'Sincronização iniciada no GitHub. Os dados aparecerão em alguns minutos.';
      toast('Sincronização do Instagram iniciada');
      setTimeout(loadInstagramMirror, 90000);
    } catch (error) { toast(error.message || 'Falha ao sincronizar'); }
    finally { button.disabled = false; button.textContent = 'Sincronizar'; }
  };

  async function loadMetrics() {
    const root = el('metricDashboard');
    try {
      const response = await fetch('/api/metrics'), data = await response.json();
      const formats = data.summary?.porFormato || {};
      const entries = Object.entries(formats);
      const totals = entries.reduce((acc, [, value]) => ({ posts: acc.posts + (value.posts || 0), reach: Math.max(acc.reach, value.alcanceMedio || 0) }), { posts: 0, reach: 0 });
      const best = entries.sort((a, b) => (b[1].alcanceMedio || 0) - (a[1].alcanceMedio || 0))[0];
      root.innerHTML = `<div class="metric-card"><span>Posts analisados</span><strong>${fmt(totals.posts)}</strong></div><div class="metric-card"><span>Melhor alcance médio</span><strong>${fmt(totals.reach)}</strong></div><div class="metric-card"><span>Formato líder</span><strong>${escapeHtml(best?.[0] || '—')}</strong></div><div class="metric-card"><span>Última coleta</span><strong>${data.summary?.atualizadoEm ? new Date(data.summary.atualizadoEm).toLocaleDateString('pt-BR') : '—'}</strong></div>`;
    } catch { root.innerHTML = '<div class="empty">Métricas indisponíveis.</div>'; }
  }
  el('refreshMetrics').onclick = loadMetrics;

  async function loadCalendar() {
    try {
      const items = await (await fetch('/api/calendar')).json();
      el('calendarList').innerHTML = items.slice(0, 8).map(item => `<div class="calendar-item"><strong>${new Date(item.scheduledAt).toLocaleString('pt-BR')}</strong>${escapeHtml(item.queueId)} • ${escapeHtml(item.status)}</div>`).join('') || '<div class="empty">Nenhuma publicação agendada.</div>';
    } catch { el('calendarList').innerHTML = '<div class="empty">Agenda indisponível.</div>'; }
  }
  el('schedulePost').onclick = async () => {
    if (!lastQueuedId) return toast('Abra um projeto aprovado da fila.');
    const scheduledAt = el('scheduleAt').value; if (!scheduledAt) return toast('Escolha a data e o horário.');
    try {
      const response = await fetch('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: lastQueuedId, scheduledAt: new Date(scheduledAt).toISOString() }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      toast('Publicação agendada'); loadCalendar();
    } catch (error) { toast(error.message); }
  };

  async function loadHealth() {
    const root = el('healthPanel');
    try {
      const data = await (await fetch('/api/health')).json();
      const labels = { github: 'GitHub conectado', ffmpeg: 'Conversão MP4', tts: 'Narração neural', instagramMirror: 'Espelho do Instagram' };
      root.innerHTML = Object.entries(data.capabilities || {}).map(([key, value]) => `<div class="health-item ${value ? 'ok' : 'bad'}"><b>${value ? '✓' : '!' } ${labels[key] || key}</b><span>${value ? 'Disponível' : 'Precisa de preparação'}</span></div>`).join('');
    } catch { root.innerHTML = '<div class="health-item bad"><b>Servidor indisponível</b><span>Reinicie o Studio.</span></div>'; }
  }
  el('settingsButton').onclick = () => { loadHealth(); el('settingsDialog').showModal(); };
  el('closeSettings').onclick = () => el('settingsDialog').close();

  const observer = new MutationObserver(() => { el('schedulePost').disabled = !lastQueuedId || el('publishInstagram').disabled; });
  observer.observe(el('publishInstagram'), { attributes: true });
  document.addEventListener('input', () => {
    clearTimeout(window.__bdiAutosaveTimer);
    window.__bdiAutosaveTimer = setTimeout(() => {
      try { localStorage.setItem('bdi-studio-autosave', JSON.stringify({ project: state, caption: el('caption').value, savedAt: new Date().toISOString() })); } catch {}
    }, 700);
  });

  const nextHour = new Date(Date.now() + 60 * 60 * 1000); nextHour.setMinutes(0, 0, 0);
  el('scheduleAt').value = `${nextHour.getFullYear()}-${String(nextHour.getMonth() + 1).padStart(2, '0')}-${String(nextHour.getDate()).padStart(2, '0')}T${String(nextHour.getHours()).padStart(2, '0')}:00`;
  if (!el('narrationText').value) el('narrationText').value = narrationScript();
  syncPublicationOptions(); render(); loadInstagramMirror(); loadMetrics(); loadCalendar();
})();
