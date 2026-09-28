(() => {
  const rootId = 'supabase-course-reviews';
  const state = {
    course: null,
    reviews: [],
    loading: true,
    error: '',
    message: ''
  };

  const params = new URLSearchParams(location.search);
  const slug = params.get('c') || '';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function clampRating(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return Math.min(5, Math.max(1, Math.round(n)));
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function ratingPill(label, value) {
    if (!value) return '';
    return `<span class="review-pill">${esc(label)} ${esc(value)}/5</span>`;
  }

  function findLegacyExperienceBlock() {
    const courseRoot = document.querySelector('#course-v4-root');
    if (!courseRoot) return null;
    const candidates = [...courseRoot.querySelectorAll('section, article, div')]
      .filter((node) => {
        const text = node.innerText || '';
        return text.includes('En GitHub Pages') || text.includes('guardada en este navegador') || text.includes('localStorage');
      })
      .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    return candidates[0] || null;
  }

  function ensureStyles() {
    if (document.querySelector('#course-reviews-style')) return;
    const style = document.createElement('style');
    style.id = 'course-reviews-style';
    style.textContent = `
      .db-reviews{max-width:1120px;margin:22px auto;padding:0 18px 26px;}
      .db-reviews-card{background:var(--surface,rgba(255,255,255,.9));border:1px solid var(--line,rgba(30,41,59,.14));border-radius:28px;padding:24px;box-shadow:var(--shadow,0 18px 50px rgba(15,23,42,.12));}
      .db-reviews-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px;}
      .db-reviews-kicker{font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#64748b);}
      .db-reviews-title{font-size:clamp(1.45rem,2vw,2rem);font-weight:900;margin:4px 0;color:var(--text-strong,#0f172a);}
      .db-reviews-sub{color:var(--muted,#64748b);margin:0;max-width:760px;}
      .db-status{border-radius:16px;padding:10px 12px;font-weight:800;font-size:.92rem;background:rgba(14,165,233,.12);color:var(--text-strong,#0f172a);}
      .db-status.error{background:rgba(239,68,68,.12);}
      .db-review-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 22px;}
      .db-review-form label{display:flex;flex-direction:column;gap:6px;font-weight:800;color:var(--text-strong,#0f172a);font-size:.9rem;}
      .db-review-form input,.db-review-form select,.db-review-form textarea{width:100%;border:1px solid var(--line,rgba(30,41,59,.16));border-radius:16px;background:var(--surface-solid,#fff);color:var(--text-strong,#0f172a);padding:11px 12px;font:inherit;outline:none;}
      .db-review-form textarea{min-height:116px;resize:vertical;}
      .db-review-form .span-2{grid-column:span 2;}
      .db-review-form .span-4{grid-column:1/-1;}
      .db-review-actions{display:flex;justify-content:space-between;gap:12px;align-items:center;grid-column:1/-1;}
      .db-review-help{color:var(--muted,#64748b);font-size:.9rem;margin:0;}
      .db-review-submit,.review-like{border:0;border-radius:999px;padding:11px 16px;font-weight:900;cursor:pointer;background:var(--cyan,#38bdf8);color:#06121f;}
      .db-review-submit:disabled,.review-like:disabled{opacity:.55;cursor:not-allowed;}
      .review-list{display:grid;gap:12px;}
      .review-item{border:1px solid var(--line,rgba(30,41,59,.14));border-radius:20px;padding:16px;background:rgba(255,255,255,.55);}
      html[data-theme="dark"] .review-item{background:rgba(15,23,42,.42);}
      .review-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;color:var(--muted,#64748b);font-size:.9rem;}
      .review-author{font-weight:900;color:var(--text-strong,#0f172a);}
      .review-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:rgba(148,163,184,.16);font-weight:800;font-size:.82rem;color:var(--text-strong,#0f172a);}
      .review-comment{white-space:pre-wrap;margin:8px 0 12px;color:var(--text-strong,#0f172a);line-height:1.55;}
      .review-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;}
      .review-empty{border:1px dashed var(--line-strong,rgba(30,41,59,.25));border-radius:20px;padding:18px;color:var(--muted,#64748b);font-weight:800;text-align:center;}
      @media(max-width:760px){.db-reviews-head,.db-review-actions{flex-direction:column;align-items:stretch}.db-review-form{grid-template-columns:1fr}.db-review-form .span-2,.db-review-form .span-4{grid-column:auto}}
    `;
    document.head.append(style);
  }

  function render() {
    ensureStyles();
    let mount = document.querySelector(`#${rootId}`);
    if (!mount) {
      mount = document.createElement('section');
      mount.id = rootId;
      mount.className = 'db-reviews';
      const main = document.querySelector('#contenido') || document.body;
      main.append(mount);
    }

    const courseLabel = state.course ? `${state.course.code} · ${state.course.name}` : 'este ramo';
    const status = state.error
      ? `<div class="db-status error">${esc(state.error)}</div>`
      : state.message
        ? `<div class="db-status">${esc(state.message)}</div>`
        : '';

    const list = state.loading
      ? '<div class="review-empty">Cargando comentarios desde la base de datos...</div>'
      : state.reviews.length
        ? state.reviews.map((review) => `
          <article class="review-item" data-review-id="${esc(review.id)}">
            <div class="review-meta">
              <span class="review-author">${esc(review.student_name || 'Estudiante anónimo')}</span>
              ${review.professor_name ? `<span>con ${esc(review.professor_name)}</span>` : ''}
              ${review.term_year ? `<span>${esc(review.term_semester || 'Semestre')} ${esc(review.term_year)}</span>` : ''}
              ${review.created_at ? `<span>${esc(formatDate(review.created_at))}</span>` : ''}
            </div>
            <div class="review-meta">
              ${ratingPill('Dificultad', review.difficulty)}
              ${ratingPill('Carga', review.workload)}
              ${ratingPill('Utilidad', review.usefulness)}
              ${review.study_hours ? `<span class="review-pill">${esc(review.study_hours)} h/sem aprox.</span>` : ''}
            </div>
            <p class="review-comment">${esc(review.comment)}</p>
            <div class="review-footer">
              <span class="review-pill">${esc(review.course_code || state.course?.code || '')}</span>
              <button class="review-like" type="button" data-like-review="${esc(review.id)}">Me gusta · ${esc(review.likes_count || 0)}</button>
            </div>
          </article>
        `).join('')
        : '<div class="review-empty">Todavía no hay comentarios publicados para este ramo. Sé la primera persona en aportar.</div>';

    mount.innerHTML = `
      <div class="db-reviews-card">
        <div class="db-reviews-head">
          <div>
            <div class="db-reviews-kicker">Experiencia Estudiantil conectada</div>
            <h2 class="db-reviews-title">Comentarios de ${esc(courseLabel)}</h2>
            <p class="db-reviews-sub">Los comentarios se guardan en Supabase y quedan asociados a la ficha del ramo. Al recargar la página siguen apareciendo.</p>
          </div>
          ${status}
        </div>

        <form class="db-review-form" id="db-review-form">
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
          <div class="db-review-actions">
            <p class="db-review-help">No publiques datos sensibles. Tu comentario quedará visible en la ficha de este ramo.</p>
            <button class="db-review-submit" type="submit" ${state.loading ? 'disabled' : ''}>Publicar comentario</button>
          </div>
        </form>

        <div class="review-list">${list}</div>
      </div>
    `;
  }

  async function loadReviews() {
    if (!slug || !window.WikiDiftelDB?.getReviewsForCourse) {
      state.loading = false;
      state.error = 'No se pudo cargar la conexión con la base de datos.';
      render();
      return;
    }

    state.loading = true;
    state.error = '';
    render();

    try {
      const result = await window.WikiDiftelDB.getReviewsForCourse(slug);
      state.course = result.course;
      state.reviews = result.reviews || [];
      state.error = result.course ? '' : 'No se encontró este ramo en la base de datos.';
    } catch (error) {
      state.error = 'No se pudieron cargar los comentarios desde Supabase.';
      console.warn(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    data.difficulty = clampRating(data.difficulty);
    data.workload = clampRating(data.workload);
    data.usefulness = clampRating(data.usefulness);

    try {
      button.disabled = true;
      state.error = '';
      state.message = 'Guardando comentario...';
      render();
      await window.WikiDiftelDB.submitCourseReview(slug, data);
      state.message = 'Comentario publicado y guardado en la base de datos.';
      await loadReviews();
    } catch (error) {
      state.message = '';
      state.error = error.message || 'No se pudo guardar el comentario.';
      render();
      console.warn(error);
    }
  }

  async function handleLike(button) {
    const reviewId = button.dataset.likeReview;
    try {
      button.disabled = true;
      const result = await window.WikiDiftelDB.likeCourseReview(reviewId);
      if (result?.likes_count !== undefined) {
        button.textContent = `Me gusta · ${result.likes_count}`;
      }
    } catch (error) {
      state.error = 'No se pudo registrar el Me gusta.';
      render();
      console.warn(error);
    }
  }

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'db-review-form') handleSubmit(event);
  });

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-like-review]');
    if (button) handleLike(button);
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const legacy = findLegacyExperienceBlock();
      if (legacy) legacy.style.display = 'none';
      loadReviews();
    }, 350);
  });
})();
