(() => {
  const ROOT_ID = 'stable-course-reviews';
  const STYLE_ID = 'stable-course-reviews-style';
  const slug = new URLSearchParams(location.search).get('c') || '';
  const state = { course: null, reviews: [], sort: 'recent', loading: true, saving: false, message: '', error: '' };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const cleanInt = (value) => value === '' || value == null ? null : (Number.isFinite(Number(value)) ? Math.round(Number(value)) : null);

  function ensureStyles() {
    if ($(`#${STYLE_ID}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-hidden-legacy-review-form="true"]{display:none!important;}
      .stable-reviews{max-width:1120px;margin:24px auto 34px;padding:0 18px}.stable-reviews-card{background:var(--surface,rgba(255,255,255,.92));border:1px solid var(--line,rgba(30,41,59,.14));border-radius:28px;padding:24px;box-shadow:var(--shadow,0 18px 50px rgba(15,23,42,.12))}.stable-reviews-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.stable-reviews-kicker{font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#64748b)}.stable-reviews-title{font-size:clamp(1.45rem,2vw,2rem);font-weight:900;margin:4px 0;color:var(--text-strong,#0f172a)}.stable-reviews-sub{margin:0;color:var(--muted,#64748b);max-width:740px}.stable-status{border-radius:16px;padding:10px 12px;font-weight:800;font-size:.92rem;background:rgba(14,165,233,.12);color:var(--text-strong,#0f172a);max-width:360px}.stable-status.error{background:rgba(239,68,68,.14)}.stable-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:center;margin:18px 0;flex-wrap:wrap}.stable-toolbar label{display:flex;gap:8px;align-items:center;font-weight:900;color:var(--text-strong,#0f172a)}.stable-toolbar select,.stable-form input,.stable-form select,.stable-form textarea{border:1px solid var(--line,rgba(30,41,59,.16));border-radius:16px;background:var(--surface-solid,#fff);color:var(--text-strong,#0f172a);padding:11px 12px;font:inherit;outline:none}.stable-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0 8px}.stable-form label{display:flex;flex-direction:column;gap:6px;font-size:.9rem;font-weight:900;color:var(--text-strong,#0f172a)}.stable-form textarea{min-height:126px;resize:vertical}.stable-form .span-2{grid-column:span 2}.stable-form .span-4{grid-column:1/-1}.stable-actions{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.stable-help{margin:0;color:var(--muted,#64748b);font-size:.92rem}.stable-submit,.stable-like{border:0;border-radius:999px;padding:11px 16px;font-weight:900;cursor:pointer;background:var(--cyan,#38bdf8);color:#06121f}.stable-submit:disabled,.stable-like:disabled{opacity:.55;cursor:not-allowed}.stable-list{display:grid;gap:12px;margin-top:14px}.stable-empty{border:1px dashed var(--line-strong,rgba(30,41,59,.25));border-radius:20px;padding:18px;text-align:center;color:var(--muted,#64748b);font-weight:800}.stable-review{border:1px solid var(--line,rgba(30,41,59,.14));border-radius:20px;padding:16px;background:rgba(255,255,255,.56)}html[data-theme="dark"] .stable-review{background:rgba(15,23,42,.42)}.stable-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;color:var(--muted,#64748b);font-size:.9rem}.stable-author{font-weight:900;color:var(--text-strong,#0f172a)}.stable-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:rgba(148,163,184,.16);font-weight:800;font-size:.82rem;color:var(--text-strong,#0f172a)}.stable-comment{white-space:pre-wrap;margin:9px 0 12px;color:var(--text-strong,#0f172a);line-height:1.55}.stable-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}@media(max-width:760px){.stable-reviews-head,.stable-actions{flex-direction:column;align-items:stretch}.stable-form{grid-template-columns:1fr}.stable-form .span-2,.stable-form .span-4{grid-column:auto}.stable-toolbar{align-items:stretch}.stable-toolbar label{justify-content:space-between}.stable-toolbar select{width:100%}}
    `;
    document.head.append(style);
  }

  function hideLegacyReviewFormOnly() {
    const root = $('#course-v4-root');
    if (!root) return;
    $$('form', root).forEach((form) => {
      if (form.closest(`#${ROOT_ID}`)) return;
      const text = (form.innerText || form.textContent || '').toLowerCase();
      const isOldReviewForm = text.includes('publicar como estudiante anónimo') || text.includes('contenido más difícil') || text.includes('consejo para aprobar') || (text.includes('cuenta tu experiencia') && text.includes('comentario'));
      if (isOldReviewForm) {
        form.setAttribute('data-hidden-legacy-review-form', 'true');
        form.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function mountRoot() {
    ensureStyles();
    hideLegacyReviewFormOnly();
    let mount = $(`#${ROOT_ID}`);
    if (!mount) {
      mount = document.createElement('section');
      mount.id = ROOT_ID;
      mount.className = 'stable-reviews';
      const courseRoot = $('#course-v4-root');
      if (courseRoot?.parentNode) courseRoot.insertAdjacentElement('afterend', mount);
      else ($('#contenido') || document.body).append(mount);
    }
    return mount;
  }

  function formatDate(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function sortedReviews() {
    const reviews = [...state.reviews];
    const recent = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (state.sort === 'old') return reviews.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    if (state.sort === 'likes') return reviews.sort((a, b) => num(b.likes_count) - num(a.likes_count) || recent(a, b));
    if (state.sort === 'popular') return reviews.sort((a, b) => ((num(b.likes_count) * 2 + num(b.usefulness)) - (num(a.likes_count) * 2 + num(a.usefulness))) || recent(a, b));
    return reviews.sort(recent);
  }

  function pill(label, value) {
    return value ? `<span class="stable-pill">${esc(label)} ${esc(value)}/5</span>` : '';
  }

  function renderReviews() {
    if (state.loading) return '<div class="stable-empty">Cargando comentarios...</div>';
    const reviews = sortedReviews();
    if (!reviews.length) return '<div class="stable-empty">Todavía no hay comentarios publicados para este ramo. Sé la primera persona en aportar.</div>';
    return reviews.map((review) => `
      <article class="stable-review" data-review-id="${esc(review.id)}">
        <div class="stable-meta"><span class="stable-author">${esc(review.student_name || 'Estudiante anónimo')}</span>${review.professor_name ? `<span>con ${esc(review.professor_name)}</span>` : ''}${review.term_year ? `<span>${esc(review.term_semester || 'Semestre')} ${esc(review.term_year)}</span>` : ''}${review.created_at ? `<span>${esc(formatDate(review.created_at))}</span>` : ''}</div>
        <div class="stable-meta">${pill('Dificultad', review.difficulty)}${pill('Carga', review.workload)}${pill('Utilidad', review.usefulness)}${review.study_hours ? `<span class="stable-pill">${esc(review.study_hours)} h/sem aprox.</span>` : ''}</div>
        <p class="stable-comment">${esc(review.comment)}</p>
        <div class="stable-footer"><span class="stable-pill">${esc(review.course_code || state.course?.code || '')}</span><button class="stable-like" type="button" data-review-like="${esc(review.id)}">Me gusta · ${esc(review.likes_count || 0)}</button></div>
      </article>
    `).join('');
  }

  function render() {
    const mount = mountRoot();
    const courseLabel = state.course ? `${state.course.code} · ${state.course.name}` : 'este ramo';
    const status = state.error ? `<div class="stable-status error">${esc(state.error)}</div>` : state.message ? `<div class="stable-status">${esc(state.message)}</div>` : '';
    mount.innerHTML = `
      <div class="stable-reviews-card">
        <div class="stable-reviews-head"><div><div class="stable-reviews-kicker">Experiencia estudiantil</div><h2 class="stable-reviews-title">Comentarios de ${esc(courseLabel)}</h2><p class="stable-reviews-sub">Comparte tu experiencia de forma clara y respetuosa para orientar a futuras generaciones.</p></div>${status}</div>
        <div class="stable-toolbar"><strong>${esc(state.reviews.length)} comentario${state.reviews.length === 1 ? '' : 's'}</strong><label>Ordenar por<select id="stable-review-sort"><option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>Más recientes</option><option value="old" ${state.sort === 'old' ? 'selected' : ''}>Más antiguos</option><option value="popular" ${state.sort === 'popular' ? 'selected' : ''}>Más populares</option><option value="likes" ${state.sort === 'likes' ? 'selected' : ''}>Más Me gusta</option></select></label></div>
        <div class="stable-list" id="stable-review-list">${renderReviews()}</div>
        <form class="stable-form" id="stable-review-form" action="" method="post" novalidate>
          <label class="span-2">Nombre o alias opcional<input name="student_name" maxlength="80" placeholder="Ej: estudiante anónimo"></label>
          <label class="span-2">Profesor/a opcional<input name="professor_name" maxlength="120" placeholder="Nombre del profesor/a"></label>
          <label>Año<input name="term_year" type="number" min="2020" max="2035" placeholder="2026"></label>
          <label>Semestre cursado<select name="term_semester"><option value="">No indicar</option><option value="1">1</option><option value="2">2</option><option value="Verano">Verano</option></select></label>
          <label>Dificultad<select name="difficulty" required><option value="">Elegir</option><option value="1">1 - Baja</option><option value="2">2</option><option value="3">3 - Media</option><option value="4">4</option><option value="5">5 - Alta</option></select></label>
          <label>Carga de trabajo<select name="workload" required><option value="">Elegir</option><option value="1">1 - Baja</option><option value="2">2</option><option value="3">3 - Media</option><option value="4">4</option><option value="5">5 - Alta</option></select></label>
          <label>Utilidad<select name="usefulness" required><option value="">Elegir</option><option value="1">1 - Baja</option><option value="2">2</option><option value="3">3 - Media</option><option value="4">4</option><option value="5">5 - Alta</option></select></label>
          <label>Horas/semana aprox.<input name="study_hours" type="number" min="0" max="80" placeholder="Ej: 6"></label>
          <label class="span-4">Comentario<textarea name="comment" minlength="20" maxlength="1500" required placeholder="Cuenta tu experiencia: cómo estudiar, qué fue difícil, qué recomiendas, etc."></textarea></label>
          <div class="stable-actions"><p class="stable-help">Evita publicar datos sensibles. Tu comentario será visible en la ficha de este ramo.</p><button class="stable-submit" type="submit" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Publicando...' : 'Publicar comentario'}</button></div>
        </form>
      </div>
    `;
  }

  async function load() {
    render();
    if (!slug || !window.WikiDiftelDB?.getCourseBySlug) {
      state.loading = false;
      state.error = 'No pudimos cargar la experiencia estudiantil por ahora.';
      render();
      return;
    }
    try {
      state.course = await window.WikiDiftelDB.getCourseBySlug(slug);
      await refreshReviews(false);
    } catch (error) {
      console.warn(error);
      state.loading = false;
      state.error = 'No pudimos cargar la experiencia estudiantil por ahora.';
      render();
    }
  }

  async function refreshReviews(showLoading = true) {
    if (!window.WikiDiftelDB?.getReviewsForCourse) return;
    try {
      if (showLoading) state.loading = true;
      const result = await window.WikiDiftelDB.getReviewsForCourse(slug);
      state.course = result.course || state.course;
      state.reviews = Array.isArray(result.reviews) ? result.reviews : [];
      state.error = '';
    } catch (error) {
      console.warn(error);
      state.error = 'No pudimos cargar los comentarios por ahora.';
    } finally {
      state.loading = false;
      render();
    }
  }

  function validate(data) {
    const comment = String(data.comment || '').trim();
    if (comment.length < 20) return 'Escribe un comentario de al menos 20 caracteres.';
    if (!data.difficulty || !data.workload || !data.usefulness) return 'Completa dificultad, carga de trabajo y utilidad.';
    const hours = cleanInt(data.study_hours);
    if (hours !== null && (hours < 0 || hours > 80)) return 'Las horas aproximadas deben estar entre 0 y 80.';
    return '';
  }

  async function submitReview(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const validation = validate(data);
    if (validation) {
      state.error = validation;
      state.message = '';
      render();
      return;
    }
    try {
      state.saving = true;
      state.error = '';
      state.message = 'Publicando comentario...';
      render();
      await window.WikiDiftelDB.submitCourseReview(slug, data);
      state.saving = false;
      state.message = 'Comentario publicado correctamente.';
      await refreshReviews(false);
      const currentForm = $('#stable-review-form');
      if (currentForm) currentForm.reset();
    } catch (error) {
      console.warn(error);
      state.saving = false;
      state.message = '';
      state.error = 'No pudimos publicar el comentario. Revisa los campos e intenta nuevamente.';
      render();
    }
  }

  async function likeReview(button) {
    const reviewId = button.dataset.reviewLike;
    if (!reviewId || !window.WikiDiftelDB?.likeCourseReview) return;
    try {
      button.disabled = true;
      const result = await window.WikiDiftelDB.likeCourseReview(reviewId);
      const review = state.reviews.find((item) => String(item.id) === String(reviewId));
      if (review && result?.likes_count !== undefined) review.likes_count = result.likes_count;
      state.message = result?.inserted === false ? 'Ya habías marcado Me gusta en este comentario.' : '';
      render();
    } catch (error) {
      console.warn(error);
      state.error = 'No pudimos registrar el Me gusta por ahora.';
      render();
    }
  }

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'stable-review-form') {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      submitReview(event.target);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'stable-review-sort') {
      state.sort = event.target.value || 'recent';
      state.error = '';
      render();
    }
  });

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-review-like]');
    if (button) likeReview(button);
  });

  document.addEventListener('DOMContentLoaded', () => {
    load();
    setTimeout(hideLegacyReviewFormOnly, 350);
    setTimeout(hideLegacyReviewFormOnly, 1200);
  });
})();