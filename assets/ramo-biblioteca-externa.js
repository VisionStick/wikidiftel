(()=>{
  const LEGACY_LIBRARIES={
    MAT070:'https://1drv.ms/f/c/D89F52375DFA1E84/AiuKjm0ymMpAvb2_Crz7Ao4?e=8JUDhu',
    MAT071:'https://1drv.ms/f/c/D89F52375DFA1E84/Ar18b-rhXMFNhbDNLbaHXp4?e=Q5xXhH',
    MAT060:'https://1drv.ms/f/c/D89F52375DFA1E84/AiqnZfOjj2NFg-JoYrYbMmU?e=9lpcZg',
    MAT061:'https://1drv.ms/f/c/D89F52375DFA1E84/Aqtk6V9e3b1KkGvNmgboAGw?e=JSBSng',
    FIS100:'https://1drv.ms/f/c/D89F52375DFA1E84/Am2yFXWAThlDjuiCI12havs?e=dEYLxF',
    FIS11125:'https://1drv.ms/f/c/D89F52375DFA1E84/Ap4HGSNfaCtBnwAyEpSYNu8?e=TNXNIb',
    FIS12125:'https://1drv.ms/f/c/D89F52375DFA1E84/AqDfhoML63VPhm4_bg53aJI?e=zYVqfu'
  };
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const query=()=>new URLSearchParams(location.search).get('c')||'';
  function currentCourse(remote){
    const code=String(remote?.code||document.querySelector('.course-code-title-v4')?.textContent||'').trim().toUpperCase();
    const name=String(remote?.name||document.querySelector('.course-hero-v4 h1')?.textContent||'este ramo').trim();
    return {code,name};
  }
  function card(course,items,source){
    const title=`Biblioteca de ${esc(course.code||course.name)}`;
    if(items.length){
      return `<div class="library-external-card available"><div class="library-external-head"><div><span class="eyebrow">Biblioteca del ramo</span><h3>${title}</h3><p>Recursos asociados a <strong>${esc(course.code)} – ${esc(course.name)}</strong>. Cada enlace se abre fuera de Wiki DIFTEL para mantener la ficha simple y ordenada.</p></div><span class="library-external-icon" aria-hidden="true">↗</span></div><div class="library-links-v4">${items.map((item)=>`<a class="library-button" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title||'Abrir biblioteca')} <span aria-hidden="true">→</span></a>`).join('')}</div><div class="library-external-actions"><span class="library-tag">${source==='supabase'?'Registrada en Supabase':'Biblioteca existente'}</span><span class="library-tag">Solo consulta</span></div><p class="library-policy-note">Biblioteca = consultar material. Experiencia Estudiantil = compartir opiniones y consejos sobre el ramo.</p></div>`;
    }
    return `<div class="library-external-card"><div class="library-external-head"><div><span class="eyebrow">Biblioteca del ramo</span><h3>${title}</h3><p>Todavía no hay una carpeta o recurso activo registrado para <strong>${esc(course.code)} – ${esc(course.name)}</strong>.</p></div><span class="library-external-icon" aria-hidden="true">⌛</span></div><div class="library-pending"><span aria-hidden="true">📁</span><div><strong>Biblioteca próximamente disponible.</strong><br>La ficha queda preparada para mostrarla automáticamente cuando se registre en Supabase.</div></div></div>`;
  }
  function mount(course,items,source){
    const section=document.querySelector('[data-course-library-anchor]')||[...document.querySelectorAll('.section-card-v4')].find((node)=>/biblioteca|material y recursos/i.test(node.textContent||''));
    if(!section)return false;
    section.innerHTML=card(course,items,source);
    section.classList.add('library-section-v4');
    return true;
  }
  async function load(remote){
    const course=currentCourse(remote);
    if(window.WikiDiftelDB?.getCourseLibraries){
      try{
        const result=await window.WikiDiftelDB.getCourseLibraries(query()||course.code);
        if(result?.course) Object.assign(course,currentCourse(result.course));
        if(result?.libraries?.length){mount(course,result.libraries,'supabase');return;}
      }catch(error){console.warn('No se pudo consultar course_libraries; usando respaldo disponible.',error);}
    }
    const legacy=LEGACY_LIBRARIES[course.code];
    mount(course,legacy?[{title:`Abrir biblioteca de ${course.code}`,url:legacy}]:[],'legacy');
  }
  document.addEventListener('DOMContentLoaded',()=>load());
  window.addEventListener('wikidiftel:course-hydrated',(event)=>load(event.detail?.raw));
})();