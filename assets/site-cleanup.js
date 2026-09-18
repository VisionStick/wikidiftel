(()=>{
  const parts=location.pathname.split('/').filter(Boolean);
  const repoIndex=parts.indexOf('wikidiftel');
  const depth=repoIndex>=0?Math.max(0,parts.length-repoIndex-1):parts.length;
  const base=depth?'../'.repeat(depth):'./';
  function forceIcon(){
    document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach(el=>el.remove());
    const svg=document.createElement('link');
    svg.rel='icon';
    svg.type='image/svg+xml';
    svg.href=base+'assets/telematica-usm-favicon.svg?v=10';
    document.head.append(svg);
    const apple=document.createElement('link');
    apple.rel='apple-touch-icon';
    apple.href=base+'assets/favicon.png?v=10';
    document.head.append(apple);
  }
  forceIcon();
  function cleanText(node){
    if(!node) return;
    node.querySelectorAll('a').forEach(a=>{
      const txt=(a.textContent||'').toLowerCase();
      if(txt.includes('subir material')||txt.includes('aportar material')){
        a.textContent='Opinar en ramos';
        a.href=base+'malla/';
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
    node.innerHTML=node.innerHTML
      .replaceAll('Subir material','Opinar en ramos')
      .replaceAll('Aportar material','Opinar en ramos')
      .replaceAll('¿Tienes un apunte, un certamen o una foto que no debería perderse?','Cuéntale a la siguiente generación cómo se vive cada ramo.')
      .replaceAll('Compartir material','Compartir experiencia');
  }
  setTimeout(()=>{
    forceIcon();
    cleanText(document.querySelector('.site-footer'));
    cleanText(document.querySelector('#mobile-menu'));
    cleanText(document.querySelector('main'));
  },0);
})();
