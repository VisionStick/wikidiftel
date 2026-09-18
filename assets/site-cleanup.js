(()=>{
  const parts=location.pathname.split('/').filter(Boolean);
  const repoIndex=parts.indexOf('wikidiftel');
  const depth=repoIndex>=0?Math.max(0,parts.length-repoIndex-1):parts.length;
  const base=depth?'../'.repeat(depth):'./';

  function injectPageFixes(){
    if(document.getElementById('diftel-page-hotfix')) return;
    const style=document.createElement('style');
    style.id='diftel-page-hotfix';
    style.textContent=`
      .reveal,.reveal.delay-1,.reveal.delay-2,.is-visible{opacity:1!important;transform:none!important;visibility:visible!important;}
      .page-hero{display:grid!important;visibility:visible!important;opacity:1!important;transform:none!important;min-height:auto!important;padding-top:76px!important;padding-bottom:34px!important;}
      .page-hero.compact{padding-top:76px!important;}
      .category-switch,.browser-toolbar,.section-heading.split{opacity:1!important;transform:none!important;visibility:visible!important;}
      .projects-wrap,.workshop-browser,#archivo,.people-section{margin-top:18px!important;}
      main.site-main{min-height:auto!important;}
      .nav-link[href*='wiki-diftel'],.mobile-menu a[href*='wiki-diftel'],.footer-column a[href*='wiki-diftel'],.footer-links a[href*='wiki-diftel']{display:none!important;}
    `;
    document.head.append(style);
  }

  function forceIcon(){
    document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach(el=>el.remove());
    const svg=document.createElement('link');
    svg.rel='icon';
    svg.type='image/svg+xml';
    svg.href=base+'assets/telematica-usm-favicon.svg?v=12';
    document.head.append(svg);
    const apple=document.createElement('link');
    apple.rel='apple-touch-icon';
    apple.href=base+'assets/favicon.png?v=12';
    document.head.append(apple);
  }

  function removeObsoleteWikiLinks(root=document){
    root.querySelectorAll('a').forEach(a=>{
      const txt=(a.textContent||'').trim().toLowerCase();
      const href=(a.getAttribute('href')||'').toLowerCase();
      if(href.includes('wiki-diftel.josnic.cl')||txt==='wiki ↗'||txt.includes('wiki / apuntes')||txt.includes('wiki diftel')){
        a.remove();
      }
    });
  }

  function cleanText(node){
    if(!node) return;
    node.querySelectorAll('a').forEach(a=>{
      const txt=(a.textContent||'').toLowerCase();
      if(txt.includes('subir material')||txt.includes('aportar material')||txt==='aportar'){
        a.textContent='Opinar en ramos';
        a.href=base+'malla/';
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
    node.innerHTML=node.innerHTML
      .replaceAll('Subir material','Opinar en ramos')
      .replaceAll('Aportar material','Opinar en ramos')
      .replaceAll('Aportar','Opinar')
      .replaceAll('¿Tienes un apunte, un certamen o una foto que no debería perderse?','Cuéntale a la siguiente generación cómo se vive cada ramo.')
      .replaceAll('Compartir material','Compartir experiencia');
  }

  function applyCleanup(){
    injectPageFixes();
    forceIcon();
    removeObsoleteWikiLinks(document);
    cleanText(document.querySelector('.site-footer'));
    cleanText(document.querySelector('#mobile-menu'));
    cleanText(document.querySelector('main'));
    removeObsoleteWikiLinks(document);
  }

  injectPageFixes();
  forceIcon();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyCleanup); else applyCleanup();
  setTimeout(applyCleanup,50);
  setTimeout(applyCleanup,300);
  setTimeout(applyCleanup,1000);
})();
