(()=>{
  function getRootPath(){
    const parts=location.pathname.split('/').filter(Boolean);
    const repoIndex=parts.indexOf('wikidiftel');
    const depth=repoIndex>=0?Math.max(0,parts.length-repoIndex-1):parts.length;
    return depth?'../'.repeat(depth):'./';
  }
  function norm(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function courseUrlByCode(code){return getRootPath()+'ramo/?c='+encodeURIComponent(String(code||'').trim());}
  function enhanceProgression(){
    const strip=document.querySelector('.progression-v4');
    if(!strip) return false;
    [...strip.querySelectorAll('.progress-card-v4')].forEach((card)=>{
      const label=norm(card.querySelector('small')?.textContent||'');
      const isSide=label.includes('previo')||label.includes('siguiente')||label.includes('anterior');
      if(!isSide) return;
      if(card.matches('a')) return;
      const code=(card.querySelector('span')?.textContent||'').trim();
      if(!code || code==='—') return;
      const link=document.createElement('a');
      link.className=card.className+' is-clickable-progression';
      link.href=courseUrlByCode(code);
      link.setAttribute('aria-label',`Abrir ficha de ${code}`);
      link.style.textDecoration='none';
      link.style.cursor='pointer';
      link.innerHTML=card.innerHTML;
      card.replaceWith(link);
    });
    return true;
  }
  let attempts=0;
  function tick(){
    enhanceProgression();
    attempts+=1;
    if(attempts<50) setTimeout(tick,120);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick); else tick();
})();
