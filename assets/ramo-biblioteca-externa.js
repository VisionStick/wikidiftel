(()=>{
  const LIBRARIES={
    MAT070:'https://1drv.ms/f/c/D89F52375DFA1E84/AiuKjm0ymMpAvb2_Crz7Ao4?e=8JUDhu',
    MAT071:'https://1drv.ms/f/c/D89F52375DFA1E84/Ar18b-rhXMFNhbDNLbaHXp4?e=Q5xXhH',
    MAT060:'https://1drv.ms/f/c/D89F52375DFA1E84/AiqnZfOjj2NFg-JoYrYbMmU?e=9lpcZg',
    MAT061:'https://1drv.ms/f/c/D89F52375DFA1E84/Aqtk6V9e3b1KkGvNmgboAGw?e=JSBSng',
    FIS100:'https://1drv.ms/f/c/D89F52375DFA1E84/Am2yFXWAThlDjuiCI12havs?e=dEYLxF',
    FIS111:'https://1drv.ms/f/c/D89F52375DFA1E84/Ap4HGSNfaCtBnwAyEpSYNu8?e=TNXNIb',
    FIS11125:'https://1drv.ms/f/c/D89F52375DFA1E84/Ap4HGSNfaCtBnwAyEpSYNu8?e=TNXNIb',
    FIS121:'https://1drv.ms/f/c/D89F52375DFA1E84/AqDfhoML63VPhm4_bg53aJI?e=zYVqfu',
    FIS12125:'https://1drv.ms/f/c/D89F52375DFA1E84/AqDfhoML63VPhm4_bg53aJI?e=zYVqfu'
  };

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function findCourse(){
    const params=new URLSearchParams(location.search);
    const query=(params.get('c')||params.get('q')||'').toLowerCase();
    if(Array.isArray(window.DIFTEL_COURSES)){
      return window.DIFTEL_COURSES.find((course)=>
        String(course.slug||'').toLowerCase()===query ||
        String(course.code||'').toLowerCase()===query
      );
    }
    const title=document.querySelector('.course-hero-v4 h1')?.textContent?.trim()||'este ramo';
    const code=document.querySelector('.course-code-title-v4')?.textContent?.trim()||'';
    return {code,name:title,area:''};
  }

  function makeLibrary(course){
    const code=String(course?.code||'').trim().toUpperCase();
    const name=course?.name||'este ramo';
    const url=LIBRARIES[code];
    const title=`Biblioteca de ${esc(code||name)}`;
    if(url){
      return `
        <div class="library-external-card available">
          <div class="library-external-head">
            <div>
              <span class="eyebrow">Biblioteca del ramo</span>
              <h3>${title}</h3>
              <p>Accede a apuntes, controles, certámenes y material de estudio recopilado para <strong>${esc(code)} – ${esc(name)}</strong>. El material se abre en una carpeta externa para mantener la página simple y ordenada.</p>
            </div>
            <span class="library-external-icon" aria-hidden="true">↗</span>
          </div>
          <div class="library-external-actions">
            <a class="library-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir biblioteca del ramo <span aria-hidden="true">→</span></a>
            <span class="library-tag">Carpeta externa</span>
            <span class="library-tag">Solo consulta</span>
          </div>
          <p class="library-policy-note">La biblioteca es para consultar material. La participación estudiantil dentro de esta página ocurre en Experiencia Estudiantil, mediante opiniones y comentarios del ramo.</p>
        </div>`;
    }
    return `
      <div class="library-external-card">
        <div class="library-external-head">
          <div>
            <span class="eyebrow">Biblioteca del ramo</span>
            <h3>${title}</h3>
            <p>Accede a apuntes, controles, certámenes y material de estudio cuando la carpeta esté disponible para <strong>${esc(code)} – ${esc(name)}</strong>.</p>
          </div>
          <span class="library-external-icon" aria-hidden="true">⌛</span>
        </div>
        <div class="library-pending"><span aria-hidden="true">📁</span><div><strong>Biblioteca próximamente disponible.</strong><br>Todavía estamos recopilando material para este ramo. Por ahora no hay botón porque no existe una carpeta externa asignada.</div></div>
        <p class="library-policy-note">Recuerda: Biblioteca = consultar material. Experiencia Estudiantil = compartir opiniones y consejos sobre el ramo.</p>
      </div>`;
  }

  function replaceLibrarySection(){
    const course=findCourse();
    const sections=[...document.querySelectorAll('.section-card-v4')];
    const librarySection=sections.find((section)=>/biblioteca|material organizado|material del ramo/i.test(section.textContent||''));
    if(!librarySection) return false;
    librarySection.innerHTML=makeLibrary(course);
    librarySection.classList.add('library-section-v4');
    return true;
  }

  function removeUploadLanguage(){
    const patterns=[/subir material/i,/adjuntar archivo/i,/subir apuntes/i,/subir cert[aá]menes/i,/subir controles/i,/aportar material/i,/agregar material/i];
    document.querySelectorAll('a,button,p,small,span,div').forEach((node)=>{
      const text=(node.textContent||'').trim();
      if(!text) return;
      if(patterns.some((pattern)=>pattern.test(text))){
        if(node.closest('.opinion-form-v4')) return;
        if(node.matches('a,button')) node.remove();
      }
    });
  }

  function init(){
    const done=replaceLibrarySection();
    if(done) removeUploadLanguage();
  }

  document.addEventListener('DOMContentLoaded',()=>{
    init();
    setTimeout(init,120);
    setTimeout(init,450);
  });
})();
