(() => {
  const cfg = window.WIKIDIFTEL_SUPABASE;

  async function request(path, params = {}) {
    if (!cfg?.url || !cfg?.key) {
      throw new Error('Supabase no está configurado.');
    }

    const url = new URL(`${cfg.url.replace(/\/$/, '')}/rest/v1/${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url, {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(`Supabase respondió ${response.status}: ${message}`);
    }

    return response.json();
  }

  async function getCourses() {
    return request('course_full_view', {
      select: 'id,code,slug,name,sct,summary,description,sort_order,is_active,semester_number,semester_name,area_name,area_slug,area_color',
      is_active: 'eq.true',
      order: 'semester_number.asc,sort_order.asc,code.asc'
    });
  }

  async function getCourseBySlug(slugOrCode) {
    const value = String(slugOrCode || '').trim();
    if (!value) return null;

    const bySlug = await request('course_full_view', {
      select: 'id,code,slug,name,sct,summary,description,sort_order,is_active,semester_number,semester_name,area_name,area_slug,area_color',
      slug: `eq.${value}`,
      is_active: 'eq.true',
      limit: '1'
    });

    if (bySlug[0]) return bySlug[0];

    const byCode = await request('course_full_view', {
      select: 'id,code,slug,name,sct,summary,description,sort_order,is_active,semester_number,semester_name,area_name,area_slug,area_color',
      code: `eq.${value.toUpperCase()}`,
      is_active: 'eq.true',
      limit: '1'
    });

    return byCode[0] || null;
  }

  window.WikiDiftelDB = {
    getCourses,
    getCourseBySlug
  };
})();
