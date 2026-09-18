(()=>{
  function getRootPath(){
    const parts=location.pathname.split('/').filter(Boolean);
    const repoIndex=parts.indexOf('wikidiftel');
    const depth=repoIndex>=0?Math.max(0,parts.length-repoIndex-1):parts.length;
    return depth?'../'.repeat(depth):'./';
  }
  function norm(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function courseUrlByCode(code){return getRootPath()+'ramo/?c='+encodeURIComponent(String(code||'').trim());}
  function isSideCard(card){
    const label=norm(card?.querySelector('small')?.textContent||'');
    return label.includes('previo')||label.includes('siguiente')||label.includes('anterior');
  }
  function cardCode(card){
    return (card?.querySelector('span')?.textContent||'').trim();
  }
  function enhanceProgression(){
    const strip=document.querySelector('.progression-v4');
    if(!strip) return false;
    [...strip.querySelectorAll('.progress-card-v4')].forEach((card)=>{
      if(!isSideCard(card)) return;
      const code=cardCode(card);
      if(!code || code==='—') return;
      card.classList.add('is-clickable-progression');
      card.setAttribute('role','link');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-label',`Abrir ficha de ${code}`);
      card.dataset.href=courseUrlByCode(code);
      card.style.cursor='pointer';
      card.style.textDecoration='none';
      if(card.matches('a')) card.href=courseUrlByCode(code);
    });
    return true;
  }
  document.addEventListener('click',(event)=>{
    const card=event.target.closest('.progress-card-v4.is-clickable-progression');
    if(!card || !isSideCard(card)) return;
    const href=card.dataset.href || (card.matches('a')?card.href:'');
    if(href){ event.preventDefault(); location.href=href; }
  });
  document.addEventListener('keydown',(event)=>{
    if(event.key!=='Enter' && event.key!==' ') return;
    const card=event.target.closest('.progress-card-v4.is-clickable-progression');
    if(!card) return;
    const href=card.dataset.href || (card.matches('a')?card.href:'');
    if(href){ event.preventDefault(); location.href=href; }
  });
  let attempts=0;
  function tick(){
    enhanceProgression();
    attempts+=1;
    if(attempts<80) setTimeout(tick,100);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick); else tick();
})();
