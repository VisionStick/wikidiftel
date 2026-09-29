(() => {
  const cfg = window.WIKIDIFTEL_SUPABASE;
  const COURSE_SELECT = 'id,code,slug,name,sct,summary,description,sort_order,is_active,semester_number,semester_name,area_name,area_slug,area_color';
  const REVIEW_SELECT = 'id,course_id,course_code,course_slug,course_name,student_name,professor_name,term_year,term_semester,difficulty,workload,usefulness,study_hours,comment,likes_count,created_at,status,dislikes_count';
  const REVIEW_BASE_SELECT = 'id,course_id,student_name,professor_name,term_year,term_semester,difficulty,workload,usefulness,study_hours,comment,likes_count,dislikes_count,created_at,status';

  async function request(path, params = {}, options = {}) {
    if (!cfg?.url || !cfg?.key) {
      throw new Error('Supabase no está configurado.');
    }

    const url = new URL(`${cfg.url.replace(/\/$/, '')}/rest/v1/${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    const headers = {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: 'application/json',
      ...(options.headers || {})
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(`Supabase respondió ${response.status}: ${message}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async function rpc(functionName, body = {}) {
    return request(`rpc/${functionName}`, {}, { method: 'POST', body });
  }

  async function getCourses() {
    return request('course_full_view', {
      select: COURSE_SELECT,
      is_active: 'eq.true',
      order: 'semester_number.asc,sort_order.asc,code.asc'
    });
  }

  async function getCourseBySlug(slugOrCode) {
    const value = String(slugOrCode || '').trim();
    if (!value) return null;

    const bySlug = await request('course_full_view', {
      select: COURSE_SELECT,
      slug: `eq.${value}`,
      is_active: 'eq.true',
      limit: '1'
    });

    if (bySlug[0]) return bySlug[0];

    const byCode = await request('course_full_view', {
      select: COURSE_SELECT,
      code: `eq.${value.toUpperCase()}`,
      is_active: 'eq.true',
      limit: '1'
    });

    return byCode[0] || null;
  }

  async function getReviewsForCourse(slugOrCode) {
    const course = await getCourseBySlug(slugOrCode);
    if (!course) return { course: null, reviews: [] };

    try {
      const reviews = await request('course_review_public_view', {
        select: REVIEW_SELECT,
        course_id: `eq.${course.id}`,
        order: 'created_at.desc,id.desc'
      });
      return { course, reviews };
    } catch (viewError) {
      console.warn('La vista pública de comentarios no está disponible; usando lectura compatible.', viewError);

      const reviews = await request('course_reviews', {
        select: REVIEW_BASE_SELECT,
        course_id: `eq.${course.id}`,
        status: 'eq.approved',
        order: 'created_at.desc,id.desc'
      });
      return {
        course,
        reviews: reviews.map((review) => ({
          ...review,
          course_code: course.code,
          course_slug: course.slug,
          course_name: course.name,
          likes_count: Number(review.likes_count) || 0,
          dislikes_count: Number(review.dislikes_count) || 0
        }))
      };
    }
  }

  async function submitCourseReview(slugOrCode, payload = {}) {
    const course = await getCourseBySlug(slugOrCode);
    if (!course) {
      throw new Error('No se encontró la ficha del ramo en la base de datos.');
    }

    const comment = String(payload.comment || '').trim();
    if (comment.length < 20) {
      throw new Error('Escribe una opinión un poco más completa, mínimo 20 caracteres.');
    }
    if (comment.length > 1500) {
      throw new Error('La opinión es muy larga. Máximo 1500 caracteres.');
    }

    const optionalInt = (value) => {
      if (value === '' || value === null || value === undefined) return null;
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n) : null;
    };
    const requireRange = (value, min, max, label) => {
      const n = optionalInt(value);
      if (n === null || n < min || n > max) throw new Error(`${label} debe estar entre ${min} y ${max}.`);
      return n;
    };
    const termYear = optionalInt(payload.term_year);
    if (termYear !== null && (termYear < 2020 || termYear > 2035)) {
      throw new Error('El año cursado debe estar entre 2020 y 2035.');
    }
    const studyHours = optionalInt(payload.study_hours);
    if (studyHours !== null && (studyHours < 0 || studyHours > 80)) {
      throw new Error('Las horas de estudio deben estar entre 0 y 80.');
    }
    const termSemester = String(payload.term_semester || '').trim();
    if (termSemester && !['1', '2', 'Verano'].includes(termSemester)) {
      throw new Error('Semestre cursado inválido.');
    }

    const result = await rpc('submit_course_review', {
      course_id_input: Number(course.id),
      student_name_input: String(payload.student_name || '').trim() || null,
      professor_name_input: String(payload.professor_name || '').trim() || null,
      term_year_input: termYear,
      term_semester_input: termSemester || null,
      difficulty_input: requireRange(payload.difficulty, 1, 5, 'Dificultad'),
      workload_input: requireRange(payload.workload, 1, 5, 'Carga de trabajo'),
      usefulness_input: requireRange(payload.usefulness, 1, 5, 'Utilidad'),
      study_hours_input: studyHours,
      comment_input: comment
    });

    const inserted = Array.isArray(result) ? result[0] : result;
    if (!inserted?.id || String(inserted.course_id) !== String(course.id)) {
      throw new Error('Supabase no confirmó la publicación del comentario en el ramo correcto.');
    }
    return inserted;
  }

  function getClientToken() {
    const key = 'wikidiftel-review-client-token';
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(key, token);
    }
    return token;
  }

  async function reactToCourseReview(reviewId, reaction) {
    const id = Number(reviewId);
    if (!Number.isFinite(id)) throw new Error('Comentario inválido.');
    if (!['like', 'dislike'].includes(reaction)) throw new Error('Reacción inválida.');

    const result = await rpc('set_course_review_reaction', {
      review_id_input: id,
      client_token_input: getClientToken(),
      reaction_input: reaction
    });
    return Array.isArray(result) ? result[0] : result;
  }

  async function likeCourseReview(reviewId) {
    return reactToCourseReview(reviewId, 'like');
  }

  async function dislikeCourseReview(reviewId) {
    return reactToCourseReview(reviewId, 'dislike');
  }

  window.WikiDiftelDB = {
    request,
    rpc,
    getCourses,
    getCourseBySlug,
    getReviewsForCourse,
    submitCourseReview,
    reactToCourseReview,
    likeCourseReview,
    dislikeCourseReview
  };
})();
