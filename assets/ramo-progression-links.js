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
    const sameSem=courses.filter(c=>Number(c.sem)===Number(current.sem));
    const index=sameSem.findIndex(c=>c.code===current.code);
    const prev=sameSem[index-1] || courses.filter(c=>Number(c.sem)<Number(current.sem)).at(-1) || null;
    const next=sameSem[index+1] || courses.find(c=>Number(c.sem)>Number(current.sem)) || null;
    return {prev,next};
  }
  function enhanceProgression(){
    const courses=getCourses();
    const current=findCurrentCourse(courses);
    if(!courses.length||!current) return;
    const {prev,next}=getNeighbors(courses,current);
    const cards=[...document.querySelectorAll('.progress-card-v4')];
    cards.forEach(card=>{
      const label=norm(card.querySelector('small')?.textContent||'');
      const target=label.includes('previo')||label.includes('anterior')?prev:label.includes('siguiente')?next:null;
      if(!target) return;
      const link=document.createElement('a');
      link.className=card.className+' is-clickable-progression';
      link.href=courseUrl(target);
      link.setAttribute('aria-label',`Abrir ficha de ${target.code} ${target.name}`);
      link.innerHTML=card.innerHTML;
      card.replaceWith(link);
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceProgression,0));
  }else{
    setTimeout(enhanceProgression,0);
  }
})();
