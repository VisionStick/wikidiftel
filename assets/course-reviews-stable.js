(() => {
  const ROOT_ID = 'stable-course-reviews';
  const params = new URLSearchParams(location.search);
  const slug = params.get('c') || '';

  const state = {
    course: null,
    reviews: [],
    loadingCourse: true,
    loadingReviews: false,
    submitting: false,
    message: '',
    error: '',
    sort: 'recent'
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function cleanInt(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function ensureStyles() {
    if (document.querySelector('#stable-course-reviews-style')) return;
    const style = document.createElement('style');
    style.id = 'stable-course-reviews-style';
    style.textContent = `
      [data-hidden-legacy-review="true"]{display:none!important;}
      .stable-reviews{max-width:1120px;margin:24px auto 34px;padding:0 18px;}
      .stable-reviews-card{background:var(--surface,rgba(255,255,255,.92));border:1px solid var(--line,rgba(30,41,59,.14));border-radius:28px;padding:24px;box-shadow:var(--shadow,0 18px 50px rgba(15,23,42,.12));}
      .stable-reviews-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:18px;}
      .stable-reviews-kicker{font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#64748b);}
      .stable-reviews-title{font-size:clamp(1.45rem,2vw,2rem);font-weight:900;margin:4px 0;color:var(--text-strong,#0f172a);}
      .stable-reviews-sub{margin:0;color:var(--muted,#64748b);max-width:740px;}
      .stable-status{border-radius:16px;padding:10px 12px;font-weight:800;font-size:.92rem;background:rgba(14,165,233,.12);color:var(--text-strong,#0f172a);max-width:360px;}
      .stable-status.error{background:rgba(239,68,68,.14);}
      .stable-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:center;margin:18px 0;flex-wrap:wrap;}
      .stable-toolbar label{display:flex;gap:8px;align-items:center;font-weight:900;color:var(--text-strong,#0f172a);}
      .stable-toolbar select,.stable-form input,.stable-form select,.stable-form textarea{border:1px solid var(--line,rgba(30,41,59,.16));border-radius:16px;background:var(--surface-solid,#fff);color:var(--text-strong,#0f172a);padding:11px 12px;font:inherit;outline:none;}
      .stable-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0 8px;}
      .stable-form label{display:flex;flex-direction:column;gap:6px;font-size:.9rem;font-weight:900;color:var(--text-strong,#0f172a);}
      .stable-form textarea{min-height:126px;resize:vertical;}
      .stable-form .span-2{grid-column:span 2;}
      .stable-form .span-4{grid-column:1/-1;}
      .stable-actions{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}
      .stable-help{margin:0;color:var(--muted,#64748b);font-size:.92rem;}
      .stable-submit,.stable-like{border:0;border-radius:999px;padding:11px 16px;font-weight:900;cursor:pointer;background:var(--cyan,#38bdf8);color:#06121f;}
      .stable-submit:disabled,.stable-like:disabled{opacity:.55;cursor:not-allowed;}
      .stable-list{display:grid;gap:12px;margin-top:14px;}
      .stable-empty{border:1px dashed var(--line-strong,rgba(30,41,59,.25));border-radius:20px;padding:18px;text-align:center;color:var(--muted,#64748b);font-weight:800;}
      .stable-review{border:1px solid var(--line,rgba(30,41,59,.14));border-radius:20px;padding:16px;background:rgba(255,255,255,.56);}
      html[data-theme="dark"] .stable-review{background:rgba(15,23,42,.42);}
      .stable-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;color:var(--muted,#64748b);font-size:.9rem;}
      .stable-author{font-weight:900;color:var(--text-strong,#0f172a);}
      .stable-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:rgba(148,163,184,.16);font-weight:800;font-size:.82rem;color:var(--text-strong,#0f172a);}
      .stable-comment{white-space:pre-wrap;margin:9px 0 12px;color:var(--text-strong,#0f172a);line-height:1.55;}
      .stable-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;}
      @media(max-width:760px){.stable-reviews-head,.stable-actions{flex-direction:column;align-items:stretch}.stable-form{grid-template-columns:1fr}.stable-form .span-2,.stable-form .span-4{grid-column:auto}.stable-toolbar{align-items:stretch}.stable-toolbar label{justify-content:space-between}.stable-toolbar select{width:100%}}
    `;
    document.head.append(style);
  }

  function hideLegacyExperience() {
    const courseRoot = document.querySelector('#course-v4-root');
    if (!courseRoot) return;

    const nodes = [...courseRoot.querySelectorAll('section, article, form, div')]
      .filter((node) => {
        if (node.id === ROOT_ID || node.closest(`#${ROOT_ID}`)) return false;
        const text = (node.innerText || '').toLowerCase();
        const legacyTitle = text.includes('deja algo para la siguiente generación') || text.includes('cuenta tu experiencia');
        const legacyFields = text.includes('contenido más difícil') || text.includes('consejo para aprobar') || text.includes('publicar como estudiante anónimo');
        const localHint = text.includes('github pages') || text.includes('localstorage') || text.includes('guardada en este navegador');
        return legacyTitle || legacyFields || localHint;
      })
      .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);

    nodes.slice(0, 6).forEach((node) => {
      if (node.id === 'course-v4-root') return;
      node.setAttribute('data-hidden-legacy-review', 'true');
      node.setAttribute('aria-hidden', 'true');
    });
  }

  function mountRoot() {
    ensureStyles();
    hideLegacyExperience();

    let mount = document.querySelector(`#${ROOT_ID}`);
    if (!mount) {
      mount = document.createElement('section');
      mount.id = ROOT_ID;
      mount.className = 'stable-reviews';
      const main = document.querySelector('#contenido') || document.body;
      main.append(mount);
    }
    return mount;
  }

  function sortedReviews() {
    const reviews = [...state.reviews];
    const byDate = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);

    if (state.sort === 'old') {
      return reviews.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }
    if (state.sort === 'popular') {
      return reviews.sort((a, b) => {
        const scoreB = asNumber(b.likes_count) * 2 + asNumber(b.usefulness);
        const scoreA = asNumber(a.likes_count) * 2 + asNumber(a.usefulness);
        return scoreB - scoreA || byDate(a, b);
      });
    }
    if (state.sort === 'likes') {
      return reviews.sort((a, b) => asNumber(b.likes_count) - asNumber(a.likes_count) || byDate(a, b));
    }
    return reviews.sort(byDate);
  }

  function pill(label, value) {
    if (!value) return '';
    return `<span class="stable-pill">${esc(label)} ${esc(value)}/5</span>`;
  }

  function renderReviews() {
    const list = sortedReviews();
    if (state.loadingReviews) {
      return '<div class="stable-empty">Cargando comentarios...</div>';
    }
    if (!list.length) {
      return '<div class="stable-empty">Todavía no hay comentarios publicados para este ramo. Sé la primera persona en aportar.</div>';
    }

    return list.map((review) => `
      <article class="stable-review" data-review-id="${esc(review.id)}">
        <div class="stable-meta">
          <span class="stable-author">${esc(review.student_name || 'Estudiante anónimo')}</span>
          ${review.professor_name ? `<span>con ${esc(review.professor_name)}</span>` : ''}
          ${review.term_year ? `<span>${esc(review.term_semester || 'Semestre')} ${esc(review.term_year)}</span>` : ''}
          ${review.created_at ? `<span>${esc(formatDate(review.created_at))}</span>` : ''}
        </div>
        <div class="stable-meta">
          ${pill('Dificultad', review.difficulty)}
          ${pill('Carga', review.workload)}
          ${pill('Utilidad', review.usefulness)}
          ${review.study_hours ? `<span class="stable-pill">${esc(review.study_hours)} h/sem aprox.</span>` : ''}
        </div>
        <p class="stable-comment">${esc(review.comment)}</p>
        <div class="stable-footer">
          <span class="stable-pill">${esc(review.course_code || state.course?.code || '')}</span>
          <button class="stable-like" type="button" data-review-like="${esc(review.id)}">Me gusta · ${esc(review.likes_count || 0)}</button>
        </div>
      </article>
    `).join('');
  }

  function render() {
    const mount = mountRoot();
    const courseLabel = state.course ? `${state.course.code} · ${state.course.name}` : 'este ramo';
    const status = state.error
      ? `<div class="stable-status error">${esc(state.error)}</div>`
      : state.message
        ? `<div class="stable-status">${esc(state.message)}</div>`
        : '';

    mount.innerHTML = `
      <div class="stable-reviews-card">
        <div class="stable-reviews-head">
          <div>
            <div class="stable-reviews-kicker">Experiencia estudiantil</div>
            <h2 class="stable-reviews-title">Comentarios de ${esc(courseLabel)}</h2>
            <p class="stable-reviews-sub">Comparte tu experiencia de forma clara y respetuosa para orientar a futuras generaciones.</p>
          </div>
          ${status}
        </div>

        <div class="stable-toolbar">
          <strong>${esc(state.reviews.length)} comentario${state.reviews.length === 1 ? '' : 's'}</strong>
          <label>Ordenar por
            <select id="stable-review-sort">
              <option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>Más recientes</option>
              <option value="old" ${state.sort === 'old' ? 'selected' : ''}>Más antiguos</option>
              <option value="popular" ${state.sort === 'popular' ? 'selected' : ''}>Más populares</option>
              <option value="likes" ${state.sort === 'likes' ? 'selected' : ''}>Más Me gusta</option>
            </select>
          </label>
        </div>

        <div class="stable-list" id="stable-review-list">${renderReviews()}</div>

        <form class="stable-form" id="stable-review-form" novalidate>
          <label class="span-2">Nombre o alias opcional
            <input name="student_name" maxlength="80" placeholder="Ej: estudiante anónimo">
          </label>
          <label class="span-2">Profesor/a opcional
            <input name="professor_name" maxlength="120" placeholder="Nombre del profesor/a">
          </label>
          <label>Año
            <input name="term_year" type="number" min="2020" max="2035" placeholder="2026">
          </label>
          <label>Semestre cursado
            <select name="term_semester">
              <option value="">No indicar</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="Verano">Verano</option>
            </select>
          </label>
          <label>Dificultad
            <select name="difficulty" required>
              <option value="">Elegir</option>
              <option value="1">1 - Baja</option>
              <option value="2">2</option>
              <option value="3">3 - Media</option>
              <option value="4">4</option>
              <option value="5">5 - Alta</option>
            </select>
          </label>
          <label>Carga de trabajo
            <select name="workload" required>
              <option value="">Elegir</option>
              <option value="1">1 - Baja</option>
              <option value="2">2</option>
              <option value="3">3 - Media</option>
              <option value="4">4</option>
              <option value="5">5 - Alta</option>
            </select>
          </label>
          <label>Utilidad
            <select name="usefulness" required>
              <option value="">Elegir</option>
              <option value="1">1 - Baja</option>
              <option value="2">2</option>
              <option value="3">3 - Media</option>
              <option value="4">4</option>
              <option value="5">5 - Alta</option>
            </select>
          </label>
          <label>Horas/semana aprox.
            <input name="study_hours" type="number" min="0" max="80" placeholder="Ej: 6">
          </label>
          <label class="span-4">Comentario
            <textarea name="comment" minlength="20" maxlength="1500" required placeholder="Cuenta tu experiencia: cómo estudiar, qué fue difícil, qué recomiendas, etc."></textarea>
          </label>
          <div class="stable-actions">
            <p class="stable-help">Evita publicar datos sensibles. Tu comentario será visible en la ficha de este ramo.</p>
            <button class="stable-submit" type="submit" ${state.submitting || state.loadingCourse ? 'disabled' : ''}>${state.submitting ? 'Publicando...' : 'Publicar comentario'}</button>
          </div>
        </form>
      </div>
    `;
  }

  async function loadCourseAndReviews() {
    render();

    if (!slug) {
      state.loadingCourse = false;
      state.error = 'No se pudo identificar el ramo.';
      render();
      return;
    }
    if (!window.WikiDiftelDB?.getCourseBySlug) {
      state.loadingCourse = false;
      state.error = 'No pudimos cargar la experiencia estudiantil por ahora.';
      render();
      return;
    }

    try {
      state.loadingCourse = true;
      state.error = '';
      state.course = await window.WikiDiftelDB.getCourseBySlug(slug);
      state.loadingCourse = false;

      if (!state.course) {
        state.error = 'No encontramos la ficha de este ramo.';
        render();
        return;
      }

      await refreshReviews(false);
    } catch (error) {
      console.warn(error);
      state.loadingCourse = false;
      state.error = 'No pudimos cargar la experiencia estudiantil por ahora.';
      render();
    }
  }

  async function refreshReviews(showLoading = true) {
    if (!window.WikiDiftelDB?.getReviewsForCourse) return;
    try {
      if (showLoading) {
        state.loadingReviews = true;
        render();
      }
      const result = await window.WikiDiftelDB.getReviewsForCourse(slug);
      state.course = result.course || state.course;
      state.reviews = Array.isArray(result.reviews) ? result.reviews : [];
      state.error = '';
    } catch (error) {
      console.warn(error);
      state.error = 'No pudimos cargar los comentarios por ahora. Intenta nuevamente más tarde.';
    } finally {
      state.loadingReviews = false;
      render();
    }
  }

  function validatePayload(data) {
    const comment = String(data.comment || '').trim();
    if (comment.length < 20) return 'Escribe un comentario de al menos 20 caracteres.';
    if (comment.length > 1500) return 'El comentario no puede superar los 1500 caracteres.';
    if (!data.difficulty || !data.workload || !data.usefulness) return 'Completa dificultad, carga de trabajo y utilidad.';
    const hours = cleanInt(data.study_hours);
    if (hours !== null && (hours < 0 || hours > 80)) return 'Las horas aproximadas deben estar entre 0 y 80.';
    const year = cleanInt(data.term_year);
    if (year !== null && (year < 2020 || year > 2035)) return 'El año debe estar entre 2020 y 2035.';
    return '';
  }

  async function handleSubmit(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const validation = validatePayload(data);
    if (validation) {
      state.error = validation;
      state.message = '';
      render();
      return;
    }

    try {
      state.submitting = true;
      state.error = '';
      state.message = 'Publicando comentario...';
      render();

      await window.WikiDiftelDB.submitCourseReview(slug, data);
      form.reset();
      state.message = 'Comentario publicado correctamente.';
      await refreshReviews(false);
    } catch (error) {
      console.warn(error);
      state.message = '';
      state.error = 'No pudimos publicar el comentario. Revisa los campos e intenta nuevamente.';
      render();
    } finally {
      state.submitting = false;
      render();
    }
  }

  async function handleLike(button) {
    const reviewId = button.dataset.reviewLike;
    if (!reviewId || !window.WikiDiftelDB?.likeCourseReview) return;

    try {
      button.disabled = true;
      const result = await window.WikiDiftelDB.likeCourseReview(reviewId);
      const review = state.reviews.find((item) => String(item.id) === String(reviewId));
      if (review && result?.likes_count !== undefined) review.likes_count = result.likes_count;
      state.message = result?.inserted === false ? 'Ya habías marcado Me gusta en este comentario.' : '';
      state.error = '';
      render();
    } catch (error) {
      console.warn(error);
      state.error = 'No pudimos registrar el Me gusta por ahora.';
      render();
    }
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'stable-review-sort') {
      state.sort = event.target.value || 'recent';
      state.error = '';
      render();
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'stable-review-form') {
      event.preventDefault();
      handleSubmit(event.target);
    }
  });

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-review-like]');
    if (button) handleLike(button);
  });

  document.addEventListener('DOMContentLoaded', () => {
    loadCourseAndReviews();
    setTimeout(hideLegacyExperience, 250);
    setTimeout(hideLegacyExperience, 800);
    setTimeout(hideLegacyExperience, 1600);
  });
})();
