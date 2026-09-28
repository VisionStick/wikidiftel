(() => {
  const cfg = window.WIKIDIFTEL_SUPABASE;
  const COURSE_SELECT = 'id,code,slug,name,sct,summary,description,sort_order,is_active,semester_number,semester_name,area_name,area_slug,area_color';
  const REVIEW_SELECT = 'id,course_id,course_code,course_slug,course_name,student_name,professor_name,term_year,term_semester,difficulty,workload,usefulness,study_hours,comment,likes_count,created_at,status';

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

    const reviews = await request('course_review_public_view', {
      select: REVIEW_SELECT,
      course_id: `eq.${course.id}`,
      order: 'created_at.desc,id.desc'
    });

    return { course, reviews };
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

    const cleanInt = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n) : null;
    };

    const review = {
      course_id: course.id,
      student_name: String(payload.student_name || '').trim() || null,
      professor_name: String(payload.professor_name || '').trim() || null,
      term_year: cleanInt(payload.term_year),
      term_semester: String(payload.term_semester || '').trim() || null,
      difficulty: cleanInt(payload.difficulty),
      workload: cleanInt(payload.workload),
      usefulness: cleanInt(payload.usefulness),
      study_hours: cleanInt(payload.study_hours),
      comment,
      status: 'approved',
      likes_count: 0
    };

    const inserted = await request('course_reviews', { select: '*' }, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: review
    });

    return inserted?.[0] || null;
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

  async function likeCourseReview(reviewId) {
    const id = Number(reviewId);
    if (!Number.isFinite(id)) throw new Error('Comentario inválido.');
    const result = await rpc('like_course_review', {
      review_id_input: id,
      client_token_input: getClientToken()
    });
    return Array.isArray(result) ? result[0] : result;
  }

  window.WikiDiftelDB = {
    request,
    rpc,
    getCourses,
    getCourseBySlug,
    getReviewsForCourse,
    submitCourseReview,
    likeCourseReview
  };
})();
