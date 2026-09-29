(()=>{
const DATA=window.DIFTEL_ARCHIVE_DATA||{projects:[],memories:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const years=items=>[...new Set(items.map(x=>Number(x.year)).filter(Boolean))].sort((a,b)=>b-a);
const pill=v=>`<span>${esc(v)}</span>`;
function iconFor(value){
  const key=String(value||'').toLowerCase();
  if(key.includes('taller')||key.includes('ctf'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M7 5h10l-2.5 3L17 11H7"/></svg>';
  if(key.includes('red')||key.includes('simul'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4M8 13l8 4"/></svg>';
  if(key.includes('ramo')||key.includes('malla'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 5.5v16M9 7h6M9 11h6"/></svg>';
  if(key.includes('portal')||key.includes('diftel'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="7"/></svg>';
}
function controls(items,label){
  return `<div class="archive-toolbar"><div><span class="archive-toolbar-label">Filtrar por año</span><div class="archive-controls" aria-label="Filtros de ${esc(label)}"><button type="button" class="is-active" aria-pressed="true" data-archive-year="all">Todos</button>${years(items).map(y=>`<button type="button" aria-pressed="false" data-archive-year="${y}">${y}</button>`).join('')}</div></div><span class="archive-filter-status" aria-live="polite"></span></div>`;
}
function bind(root){
  const buttons=[...root.querySelectorAll('[data-archive-year]')];
  const cards=[...root.querySelectorAll('[data-year]')];
  const status=root.querySelector('.archive-filter-status');
  const apply=btn=>{
    const year=btn.dataset.archiveYear;
    buttons.forEach(x=>{const active=x===btn;x.classList.toggle('is-active',active);x.setAttribute('aria-pressed',String(active));});
    cards.forEach(card=>{card.hidden=year!=='all'&&card.dataset.year!==year;});
    root.querySelectorAll('.project-section').forEach(section=>{section.hidden=![...section.querySelectorAll('[data-year]')].some(card=>!card.hidden);});
    root.querySelectorAll('.archive-year-block').forEach(section=>{section.hidden=![...section.querySelectorAll('[data-year]')].some(card=>!card.hidden);});
    const visible=cards.filter(card=>!card.hidden).length;
    if(status)status.textContent=`${visible} ${visible===1?'registro visible':'registros visibles'}`;
  };
  buttons.forEach(btn=>btn.addEventListener('click',()=>apply(btn)));
  if(buttons[0])apply(buttons[0]);
}
function projectCard(p){
  const category=p.type||p.category;
  return `<article class="project-card archive-card-v2" data-year="${esc(p.year)}" data-category="${esc(p.category)}"><div class="archive-card-accent" aria-hidden="true"></div><div class="project-card-top"><span class="archive-icon-v2">${iconFor(category)}</span><div class="archive-card-badges"><span class="project-label">${esc(category)}</span><span class="project-year">${esc(p.date||p.year)}</span></div></div><div class="archive-card-copy"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div><div class="archive-detail-grid"><div><small>Participantes</small><strong>${esc((p.participants||[]).join(', ')||'Por documentar')}</strong></div>${p.course?`<div><small>Ramo</small><strong>${esc(p.course)}</strong></div>`:''}${p.area?`<div><small>Área</small><strong>${esc(p.area)}</strong></div>`:''}</div><div class="archive-card-footer"><div class="project-tags">${(p.tags||[]).map(pill).join('')}</div>${p.href?`<a class="archive-action project-link" href="${esc(p.href)}"><span>${esc((p.linkLabel||'Ver proyecto').replace(/\s*→\s*$/,''))}</span><b aria-hidden="true">→</b></a>`:''}</div></article>`;
}
function memoryCard(m){
  return `<article class="memory-card archive-card-v2" data-year="${esc(m.year)}" data-category="${esc(m.category)}"><div class="archive-card-accent" aria-hidden="true"></div><div class="memory-top"><span class="archive-icon-v2">${iconFor(m.category)}</span><div class="archive-card-badges"><span class="memory-tag">${esc(m.category)}</span><span class="project-year">${esc(m.date||m.year)}</span></div></div><div class="archive-card-copy"><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p></div><div class="archive-detail-grid"><div><small>Participantes</small><strong>${esc((m.participants||[]).join(', ')||'Por documentar')}</strong></div>${m.course?`<div><small>Ramo</small><strong>${esc(m.course)}</strong></div>`:''}</div><div class="archive-card-footer"><div class="memory-meta">${(m.tags||[]).map(pill).join('')}</div>${m.href?`<a class="archive-action memory-link" href="${esc(m.href)}"><span>${esc((m.linkLabel||'Abrir').replace(/\s*→\s*$/,''))}</span><b aria-hidden="true">→</b></a>`:''}</div></article>`;
}
function renderProjects(){
  const root=document.querySelector('[data-project-archive]');if(!root)return;
  const cats=[...new Set(DATA.projects.map(x=>x.category))];
  root.innerHTML=controls(DATA.projects,'proyectos')+cats.map(cat=>{const items=DATA.projects.filter(x=>x.category===cat);return `<section class="project-section"><div class="project-section-head"><div><span class="eyebrow">${cat==='DIFTEL'?'Archivo interno':'Producción estudiantil'}</span><h2>${cat==='DIFTEL'?'Proyectos DIFTEL':'Proyectos de Telemática'}</h2><p>${cat==='DIFTEL'?'Iniciativas y herramientas construidas para la comunidad.':'Trabajos y proyectos desarrollados por estudiantes dentro o fuera de ramos.'}</p></div><span class="project-count">${items.length} proyecto${items.length===1?'':'s'}</span></div><div class="project-grid">${items.map(projectCard).join('')}</div></section>`;}).join('');
  bind(root);const n=document.querySelector('[data-project-count]');if(n)n.textContent=`${DATA.projects.length} proyectos documentados`;
}
function renderMemories(){
  const root=document.querySelector('[data-community-archive]');if(!root)return;
  root.innerHTML=controls(DATA.memories,'memoria comunitaria')+years(DATA.memories).map(y=>{const items=DATA.memories.filter(x=>Number(x.year)===y);return `<section class="archive-year-block"><div class="archive-year-head"><div><small>Archivo</small><span>${y}</span></div><em>${items.length} registro${items.length===1?'':'s'}</em></div><div class="memory-grid">${items.map(memoryCard).join('')}</div></section>`;}).join('');
  bind(root);const n=document.querySelector('[data-memory-count]');if(n)n.textContent=`${DATA.memories.length} recuerdos documentados`;
}
document.addEventListener('DOMContentLoaded',()=>{renderProjects();renderMemories();});
})();