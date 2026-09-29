(()=>{
  const DATA=window.DIFTEL_ARCHIVE_DATA||{projects:[],memories:[]};
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  const years=(items)=>[...new Set(items.map(x=>Number(x.year)).filter(Boolean))].sort((a,b)=>b-a);
  const pill=(value)=>`<span>${esc(value)}</span>`;
  function projectCard(p){
    const people=(p.participants||[]).join(', ');
    return `<article class="project-card archive-project-card" data-year="${esc(p.year)}" data-category="${esc(p.category)}"><div class="project-card-top"><span class="project-label">${esc(p.type||p.category)}</span><span class="project-year">${esc(p.date||p.year)}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><div class="project-meta"><span><strong>Participantes:</strong> ${esc(people||'Por documentar')}.</span>${p.course?`<span><strong>Ramo:</strong> ${esc(p.course)}.</span>`:''}${p.area?`<span><strong>Área:</strong> ${esc(p.area)}.</span>`:''}</div><div class="project-tags">${(p.tags||[]).map(pill).join('')}</div>${p.href?`<a class="project-link" href="${esc(p.href)}">${esc(p.linkLabel||'Ver proyecto →')}</a>`:''}</article>`;
  }
  function memoryCard(m){
    return `<article class="memory-card archive-memory-card" data-year="${esc(m.year)}" data-category="${esc(m.category)}"><div class="memory-top"><span class="memory-icon">${esc(m.icon||'•')}</span><span class="memory-tag">${esc(m.category)}</span></div><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><div class="archive-detail-list"><span><strong>Fecha:</strong> ${esc(m.date||m.year)}</span><span><strong>Participantes:</strong> ${esc((m.participants||[]).join(', ')||'Por documentar')}</span>${m.course?`<span><strong>Ramo:</strong> ${esc(m.course)}</span>`:''}</div><div class="memory-meta">${[m.year,...(m.tags||[])].map(pill).join('')}</div>${m.href?`<a class="memory-link" href="${esc(m.href)}">${esc(m.linkLabel||'Abrir →')}</a>`:''}</article>`;
  }
  function controls(items,label){
    const ys=years(items);
    return `<div class="archive-controls" aria-label="Filtros de ${esc(label)}"><button type="button" class="is-active" data-archive-year="all">Todos</button>${ys.map(y=>`<button type="button" data-archive-year="${y}">${y}</button>`).join('')}</div>`;
  }
  function bind(root){
    root.querySelectorAll('[data-archive-year]').forEach(btn=>btn.addEventListener('click',()=>{
      root.querySelectorAll('[data-archive-year]').forEach(x=>x.classList.toggle('is-active',x===btn));
      const year=btn.dataset.archiveYear;
      root.querySelectorAll('[data-year]').forEach(card=>{card.hidden=year!=='all'&&card.dataset.year!==year;});
    }));
  }
  function renderProjects(){
    const root=document.querySelector('[data-project-archive]'); if(!root)return;
    const categories=[...new Set(DATA.projects.map(x=>x.category))];
    root.innerHTML=controls(DATA.projects,'proyectos')+categories.map(category=>{
      const items=DATA.projects.filter(x=>x.category===category);
      const title=category==='DIFTEL'?'Proyectos DIFTEL':'Proyectos de Telemática';
      return `<section class="project-section"><div class="project-section-head"><div><span class="eyebrow">${category==='DIFTEL'?'Archivo interno':'Producción estudiantil'}</span><h2>${esc(title)}</h2><p>${category==='DIFTEL'?'Iniciativas y herramientas construidas para la comunidad.':'Trabajos y proyectos desarrollados por estudiantes dentro o fuera de ramos.'}</p></div><span class="project-count">${items.length} proyecto${items.length===1?'':'s'}</span></div><div class="project-grid">${items.map(projectCard).join('')}</div></section>`;
    }).join('');
    bind(root);
    const count=document.querySelector('[data-project-count]');
    if(count) count.textContent=`${DATA.projects.length} proyectos documentados`;
  }
  function renderMemories(){
    const root=document.querySelector('[data-community-archive]'); if(!root)return;
    root.innerHTML=controls(DATA.memories,'memoria comunitaria')+years(DATA.memories).map(year=>{
      const items=DATA.memories.filter(x=>Number(x.year)===year);
      return `<section class="archive-year-block"><div class="archive-year-head"><span>${year}</span><small>${items.length} registro${items.length===1?'':'s'}</small></div><div class="memory-grid">${items.map(memoryCard).join('')}</div></section>`;
    }).join('');
    bind(root);
    const count=document.querySelector('[data-memory-count]');
    if(count) count.textContent=`${DATA.memories.length} recuerdos documentados`;
  }
  document.addEventListener('DOMContentLoaded',()=>{renderProjects();renderMemories();});
})();