(()=>{
  function getRootPath(){
    const parts=location.pathname.split('/').filter(Boolean);
    const repoIndex=parts.indexOf('wikidiftel');
    const depth=repoIndex>=0?Math.max(0,parts.length-repoIndex-1):parts.length;
    return depth?'../'.repeat(depth):'./';
  }
  function norm(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function courseUrl(course){return getRootPath()+'ramo/?c='+encodeURIComponent(course.slug||course.code||'');}
  function getCourses(){return Array.isArray(window.DIFTEL_COURSES)?window.DIFTEL_COURSES:[];}
  function findCurrentCourse(courses){
    const params=new URLSearchParams(location.search);
    const q=norm(params.get('c')||params.get('q')||'');
    return courses.find(c=>norm(c.slug)===q||norm(c.code)===q) || null;
  }
  function getNeighbors(courses,current){
    if(!current) return {prev:null,next:null};
    const index=courses.findIndex(c=>c.code===current.code);
    return {prev:courses[index-1]||null,next:courses[index+1]||null};
  }
  function cardHTML(kind,course,current){
    if(!course){
      return `<div class="progress-card-v4 is-disabled"><small>${kind}</small><strong>No hay ramo ${kind.toLowerCase()} registrado.</strong><span>—</span></div>`;
    }
    const isCurrent=course.code===current.code;
    const body=`<small>${kind}</small><strong>${course.code}</strong><span>${course.name}</span>`;
    if(isCurrent) return `<div class="progress-card-v4 progression-current-v4"><small>Estás aquí</small><strong>${course.code}</strong><span>${course.name}</span></div>`;
    return `<a class="progress-card-v4 is-clickable-progression" href="${courseUrl(course)}" aria-label="Abrir ficha de ${course.code} ${course.name}">${body}</a>`;
  }
  function renderProgression(){
    const courses=getCourses();
    const current=findCurrentCourse(courses);
    if(!courses.length||!current) return false;
    const {prev,next}=getNeighbors(courses,current);
    const html=`${cardHTML('Ramo previo',prev,current)}${cardHTML('Estás aquí',current,current)}${cardHTML('Ramo siguiente',next,current)}`;
    let strip=document.querySelector('.progression-v4');
    if(strip){ strip.innerHTML=html; return true; }
    const hero=document.querySelector('.course-hero-v4') || document.querySelector('#course-v4-root');
    if(!hero) return false;
    strip=document.createElement('div');
    strip.className='section-shell progression-v4';
    strip.innerHTML=html;
    hero.insertAdjacentElement('afterend',strip);
    return true;
  }
  let attempts=0;
  function tick(){
    if(renderProgression()) return;
    attempts+=1;
    if(attempts<40) setTimeout(tick,100);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick); else tick();
})();
