/* DIFTEL SJ · buscador estático (funciona sin Django).
   Requiere assets/buscar-datos.js (window.DIFTEL_INDEX) cargado antes. */
(() => {
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const INDEX = Array.isArray(window.DIFTEL_INDEX) ? window.DIFTEL_INDEX : [];
  const q = new URLSearchParams(location.search).get('q') || '';
  const box = document.getElementById('res');
  const count = document.getElementById('res-count');
  document.querySelectorAll('input[type="search"][name="q"]').forEach((i) => { i.value = q; });

  function score(entry, terms) {
    const hay = norm([entry.c, entry.n, entry.x, entry.t].join(' '));
    let s = 0;
    for (const t of terms) {
      if (!hay.includes(t)) return -1;
      if (norm(entry.c) === t) s += 6;
      else if (norm(entry.c).startsWith(t)) s += 4;
      else if (norm(entry.n).includes(t)) s += 2;
      else s += 1;
    }
    if (entry.t === 'Ramo') s += 0.5;
    return s;
  }

  function card(e) {
    return `<a class="res-card" href="${esc(e.u)}"><span class="res-tag">${esc(e.t)}</span>`
      + `<span class="res-body"><strong>${esc(e.c ? e.c + ' · ' + e.n : e.n)}</strong><small>${esc(e.x)}</small></span>`
      + `<span class="res-arrow">→</span></a>`;
  }

  if (!box) return;
  const terms = norm(q).split(' ').filter(Boolean);
  if (!terms.length) {
    if (count) count.textContent = INDEX.length + ' elementos indexados';
    box.innerHTML = `<div class="res-hint">Escribe un código (ej: MAT070), un nombre (ej: redes), un taller o una sección.</div>`;
    return;
  }
  const hits = INDEX.map((e) => ({ e, s: score(e, terms) }))
    .filter((h) => h.s >= 0).sort((a, b) => b.s - a.s).slice(0, 40);
  if (count) count.textContent = hits.length + (hits.length === 1 ? ' resultado' : ' resultados') + ' para “' + q + '”';
  box.innerHTML = hits.length ? hits.map((h) => card(h.e)).join('')
    : `<div class="res-hint">Sin resultados para “${esc(q)}”. Prueba con un código de ramo o revisa la <a class="text-link" href="../malla/">malla completa</a>.</div>`;
})();
