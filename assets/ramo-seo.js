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

  function updateSeo() {
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

    const canonicalHref = slug
      ? `${location.origin}${location.pathname}?c=${encodeURIComponent(slug)}`
      : `${location.origin}${location.pathname}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = canonicalHref;
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateSeo();
    setTimeout(updateSeo, 120);
    setTimeout(updateSeo, 500);
  });
})();
