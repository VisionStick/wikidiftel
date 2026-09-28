(() => {
  const params = new URLSearchParams(location.search);
  const slug = params.get('c') || '';

  function ensureMetaDescription() {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    return meta;
  }

  function ensureCanonical() {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    return canonical;
  }

  function setCanonical(value = slug) {
    const canonicalHref = value
      ? `${location.origin}${location.pathname}?c=${encodeURIComponent(value)}`
      : `${location.origin}${location.pathname}`;
    ensureCanonical().href = canonicalHref;
  }

  function titleParts() {
    const parts = document.title
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2 && parts[0] !== 'Ficha de ramo') {
      return { code: parts[0], name: parts[1] };
    }
    return { code: '', name: '' };
  }

  function findVisibleText(patterns) {
    const root = document.querySelector('#course-v4-root') || document.body;
    const text = root.innerText || '';
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1] || match[0];
    }
    return '';
  }

  function descriptionFromCourse(course) {
    const semesterText = course.semester_number ? ` del semestre ${course.semester_number}` : '';
    const areaText = course.area_name ? `, área ${course.area_name}` : '';
    return `Ficha de ${course.code} · ${course.name}${semesterText}${areaText} de Ingeniería Civil Telemática USM San Joaquín. Información del ramo, SCT, área, bibliotecas y experiencia estudiantil.`;
  }

  async function updateSeoFromSupabase() {
    if (!slug || !window.WikiDiftelDB?.getCourseBySlug) return false;

    try {
      const course = await window.WikiDiftelDB.getCourseBySlug(slug);
      if (!course?.code || !course?.name) return false;

      document.title = `${course.code} · ${course.name} · DIFTEL SJ`;
      ensureMetaDescription().setAttribute('content', descriptionFromCourse(course).slice(0, 220));
      setCanonical(course.slug || slug);
      return true;
    } catch (error) {
      console.warn('[WikiDIFTEL] No se pudo actualizar SEO desde Supabase:', error);
      return false;
    }
  }

  function updateSeoFromRenderedCard() {
    const { code, name } = titleParts();
    if (!code || !name) return;

    const semester = findVisibleText([/Semestre\s+(\d+)/i]);
    const area = findVisibleText([
      /Comunicación\s*&\s*Humanidades/i,
      /Ciencias Sociales\s*&\s*Económicas/i,
      /Ciencias Básicas/i,
      /Ciencias de la Ingeniería/i,
      /Especialidad/i,
      /Competencias Transversales Sello/i,
      /Electivos/i
    ]);

    const semesterText = semester ? ` del semestre ${semester}` : '';
    const areaText = area ? `, área ${area}` : '';
    const description = `Ficha de ${code} · ${name}${semesterText}${areaText} de Ingeniería Civil Telemática USM San Joaquín. Información del ramo, SCT, área, bibliotecas y experiencia estudiantil.`;

    ensureMetaDescription().setAttribute('content', description.slice(0, 220));
    setCanonical(slug);
  }

  async function updateSeo() {
    const ok = await updateSeoFromSupabase();
    if (!ok) updateSeoFromRenderedCard();
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateSeo();
    setTimeout(updateSeo, 150);
    setTimeout(updateSeo, 600);
  });
})();
