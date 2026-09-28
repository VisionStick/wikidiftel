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
      [data-hidden-legacy-review-form="true"]{display:none!important}
      .stable-reviews{max-width:1180px;margin:0 auto 76px;padding:0 20px}
      .stable-reviews-card{background:color-mix(in srgb,var(--surface) 94%,transparent);border:1px solid var(--line);border-radius:26px;padding:clamp(20px,3vw,30px);box-shadow:var(--shadow)}
      .stable-reviews-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:22px;padding-bottom:20px;border-bottom:1px solid var(--line)}
      .stable-reviews-kicker{font-size:.76rem;font-weight:1000;letter-spacing:.1em;text-transform:uppercase;color:var(--blue)}
      .stable-reviews-title{font-size:clamp(1.65rem,3vw,2.35rem);line-height:1.08;font-weight:1000;margin:6px 0 8px;color:var(--text-strong)}
      .stable-reviews-sub{margin:0;color:var(--muted);max-width:720px;line-height:1.65}
      .stable-status{border-radius:14px;padding:10px 12px;font-weight:850;font-size:.88rem;background:color-mix(in srgb,var(--cyan) 13%,var(--surface));color:var(--text-strong);max-width:360px}
      .stable-status.error{background:color-mix(in srgb,#ef4444 13%,var(--surface))}
      .stable-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 20px}
      .stable-summary-item{border:1px solid var(--line);border-radius:16px;background:var(--surface-solid);padding:14px}
      .stable-summary-item small{display:block;color:var(--muted);font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
      .stable-summary-item strong{display:block;color:var(--text-strong);font-size:1.25rem;margin-top:5px}
      .stable-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:center;margin:0 0 16px;flex-wrap:wrap}
      .stable-toolbar>strong{color:var(--text-strong)}
      .stable-toolbar label{display:flex;gap:9px;align-items:center;font-weight:900;color:var(--text-strong)}
      .stable-toolbar select,.stable-form input,.stable-form select,.stable-form textarea{border:1px solid var(--line);border-radius:13px;background:var(--surface-solid);color:var(--text-strong);padding:11px 12px;font:inherit;outline:none;transition:border-color .18s,box-shadow .18s}
      .stable-toolbar select:focus,.stable-form input:focus,.stable-form select:focus,.stable-form textarea:focus{border-color:var(--cyan);box-shadow:0 0 0 3px color-mix(in srgb,var(--cyan) 13%,transparent)}
      .stable-content-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:22px;align-items:start}
      .stable-list{display:grid;gap:12px}
      .stable-empty{border:1px dashed var(--line-strong);border-radius:18px;padding:24px;text-align:center;color:var(--muted);font-weight:800;background:color-mix(in srgb,var(--surface) 84%,transparent)}
      .stable-review{border:1px solid var(--line);border-radius:18px;padding:17px;background:var(--surface-solid)}
      .stable-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:9px;color:var(--muted);font-size:.86rem}
      .stable-author{font-weight:1000;color:var(--text-strong)}
      .stable-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:var(--surface-2);border:1px solid var(--line);font-weight:850;font-size:.78rem;color:var(--text-strong)}
      .stable-comment{white-space:pre-wrap;margin:10px 0 13px;color:var(--text);line-height:1.62}
      .stable-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
      .stable-form-wrap{position:sticky;top:94px;border:1px solid var(--line);border-radius:20px;padding:18px;background:var(--surface-solid)}
      .stable-form-title{margin:0 0 5px;color:var(--text-strong);font-size:1.15rem;font-weight:1000}
      .stable-form-intro{margin:0 0 15px;color:var(--muted);font-size:.86rem;line-height:1.5}
      .stable-form{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:0}
      .stable-form label{display:flex;flex-direction:column;gap:6px;font-size:.82rem;font-weight:900;color:var(--text-strong)}
      .stable-form textarea{min-height:118px;resize:vertical}
      .stable-form .span-2{grid-column:1/-1}.stable-form .span-4{grid-column:1/-1}
      .stable-actions{grid-column:1/-1;display:grid;gap:10px}
      .stable-help{margin:0;color:var(--muted);font-size:.78rem;line-height:1.45}
      .stable-submit{border:0;border-radius:999px;padding:11px 16px;font-weight:1000;cursor:pointer;background:var(--cyan);color:#06121f}
      .stable-submit{width:100%}.stable-submit:disabled,.stable-reaction:disabled{opacity:.55;cursor:not-allowed}
      .stable-reactions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .stable-reaction{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:8px 11px;font:inherit;font-size:.82rem;font-weight:950;cursor:pointer;background:var(--surface-2);color:var(--text-strong);transition:transform .15s,border-color .15s,background .15s}
      .stable-reaction:hover{transform:translateY(-1px);border-color:var(--line-strong)}
      .stable-reaction.like:hover{background:color-mix(in srgb,var(--cyan) 12%,var(--surface-2))}
      .stable-reaction.dislike:hover{background:color-mix(in srgb,#ef4444 10%,var(--surface-2))}
      @media(max-width:980px){.stable-content-grid{grid-template-columns:1fr}.stable-form-wrap{position:static}.stable-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.stable-reviews{padding:0 14px;margin-bottom:52px}.stable-reviews-card{border-radius:20px;padding:17px}.stable-reviews-head{display:grid;gap:12px}.stable-summary{grid-template-columns:1fr 1fr}.stable-form{grid-template-columns:1fr}.stable-form .span-2,.stable-form .span-4{grid-column:auto}.stable-toolbar{align-items:stretch}.stable-toolbar label{display:grid;gap:6px}.stable-toolbar select{width:100%}.stable-footer{align-items:stretch}.stable-reactions{width:100%}.stable-reaction{flex:1;justify-content:center}}
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
        <div class="stable-footer"><span class="stable-pill">${esc(review.course_code || state.course?.code || '')}</span><div class="stable-reactions" aria-label="Reacciones al comentario"><button class="stable-reaction like" type="button" data-review-reaction="like" data-review-id="${esc(review.id)}" aria-label="Me gusta">👍 <span>${esc(review.likes_count || 0)}</span></button><button class="stable-reaction dislike" type="button" data-review-reaction="dislike" data-review-id="${esc(review.id)}" aria-label="No me gusta">👎 <span>${esc(review.dislikes_count || 0)}</span></button></div></div>
      </article>
    `).join('');
  }

  function summaryCards() {
    const reviews = state.reviews;
    const average = (key) => {
      const values = reviews.map((review) => num(review[key])).filter((value) => value > 0);
      return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '—';
    };
    const hours = reviews.map((review) => num(review.study_hours)).filter((value) => value > 0);
    const averageHours = hours.length ? `${Math.round(hours.reduce((sum, value) => sum + value, 0) / hours.length)} h` : '—';
    return [
      ['Dificultad', average('difficulty')],
      ['Carga', average('workload')],
      ['Utilidad', average('usefulness')],
      ['Estudio semanal', averageHours]
    ].map(([label, value]) => `<div class="stable-summary-item"><small>${label}</small><strong>${value}</strong></div>`).join('');
  }

  function render() {
    const mount = mountRoot();
    const courseLabel = state.course ? `${state.course.code} · ${state.course.name}` : 'este ramo';
    if (state.course) {
      mount.dataset.courseId = String(state.course.id || '');
      mount.dataset.courseCode = String(state.course.code || '');
      mount.dataset.courseSlug = String(state.course.slug || '');
    }
    const status = state.error ? `<div class="stable-status error">${esc(state.error)}</div>` : state.message ? `<div class="stable-status">${esc(state.message)}</div>` : '';
    mount.innerHTML = `
      <div class="stable-reviews-card">
        <div class="stable-reviews-head"><div><div class="stable-reviews-kicker">Experiencia estudiantil</div><h2 class="stable-reviews-title">Lo que cuentan sobre ${esc(courseLabel)}</h2><p class="stable-reviews-sub">Lee experiencias reales y deja contexto útil para quienes tomarán el ramo después. Los comentarios de esta sección se cargan desde la base de datos del ramo.</p></div>${status}</div>
        <div class="stable-summary">${summaryCards()}</div>
        <div class="stable-toolbar"><strong>${esc(state.reviews.length)} comentario${state.reviews.length === 1 ? '' : 's'}</strong><label>Ordenar por<select id="stable-review-sort"><option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>Más recientes</option><option value="old" ${state.sort === 'old' ? 'selected' : ''}>Más antiguos</option><option value="popular" ${state.sort === 'popular' ? 'selected' : ''}>Más populares</option><option value="likes" ${state.sort === 'likes' ? 'selected' : ''}>Más Me gusta</option></select></label></div>
        <div class="stable-content-grid">
          <div class="stable-list" id="stable-review-list">${renderReviews()}</div>
          <aside class="stable-form-wrap">
            <h3 class="stable-form-title">Cuenta tu experiencia</h3>
            <p class="stable-form-intro">Sé concreto y respetuoso. Tu opinión quedará asociada únicamente a <strong>${esc(courseLabel)}</strong>.</p>
            <form class="stable-form" id="stable-review-form" action="" method="post" novalidate>
              <label class="span-2">Nombre o alias opcional<input name="student_name" maxlength="80" placeholder="Puedes dejarlo vacío"></label>
              <label class="span-2">Profesor/a opcional<input name="professor_name" maxlength="120" placeholder="Nombre del profesor/a"></label>
              <label>Año<input name="term_year" type="number" min="2020" max="2035" placeholder="2026"></label>
              <label>Semestre cursado<select name="term_semester"><option value="">No indicar</option><option value="1">1° semestre</option><option value="2">2° semestre</option><option value="Verano">Verano</option></select></label>
              <label>Dificultad<select name="difficulty" required><option value="">Elegir</option><option value="1">1 - Baja</option><option value="2">2</option><option value="3">3 - Media</option><option value="4">4</option><option value="5">5 - Alta</option></select></label>
              <label>Carga<select name="workload" required><option value="">Elegir</option><option value="1">1 - Baja</option><option value="2">2</option><option value="3">3 - Media</option><option value="4">4</option><option value="5">5 - Alta</option></select></label>
              <label>Utilidad<select name="usefulness" required><option value="">Elegir</option><option value="1">1 - Baja</option><option value="2">2</option><option value="3">3 - Media</option><option value="4">4</option><option value="5">5 - Alta</option></select></label>
              <label>Horas/semana<input name="study_hours" type="number" min="0" max="80" placeholder="Ej: 6"></label>
              <label class="span-4">Comentario<textarea name="comment" minlength="20" maxlength="1500" required placeholder="¿Cómo fue cursarlo? ¿Qué costó más? ¿Qué consejo dejarías?"></textarea></label>
              <div class="stable-actions"><p class="stable-help">Evita datos sensibles. La opinión se guarda en la base comunitaria y se muestra solo en la ficha de este ramo.</p><button class="stable-submit" type="submit" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Publicando...' : 'Publicar comentario'}</button></div>
            </form>
          </aside>
        </div>
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
      const inserted = await window.WikiDiftelDB.submitCourseReview(slug, data);
      if (!inserted?.id || String(inserted.course_id) !== String(state.course?.id)) {
        throw new Error('Supabase no confirmó correctamente la asociación del comentario con este ramo.');
      }
      state.saving = false;
      state.message = 'Comentario publicado y asociado correctamente a este ramo.';
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

  async function reactToReview(button) {
    const reviewId = button.dataset.reviewId;
    const reaction = button.dataset.reviewReaction;
    if (!reviewId || !['like', 'dislike'].includes(reaction) || !window.WikiDiftelDB?.reactToCourseReview) return;
    try {
      button.disabled = true;
      state.error = '';
      const result = await window.WikiDiftelDB.reactToCourseReview(reviewId, reaction);
      const review = state.reviews.find((item) => String(item.id) === String(reviewId));
      if (review) {
        if (result?.likes_count !== undefined) review.likes_count = result.likes_count;
        if (result?.dislikes_count !== undefined) review.dislikes_count = result.dislikes_count;
      }
      state.message = result?.action === 'changed'
        ? 'Reacción actualizada.'
        : result?.action === 'removed'
          ? 'Reacción retirada.'
          : '';
      render();
    } catch (error) {
      console.warn(error);
      state.error = 'No pudimos registrar la reacción por ahora.';
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
    const button = event.target?.closest?.('[data-review-reaction]');
    if (button) reactToReview(button);
  });

  document.addEventListener('DOMContentLoaded', () => {
    load();
    setTimeout(hideLegacyReviewFormOnly, 350);
    setTimeout(hideLegacyReviewFormOnly, 1200);
  });
})();