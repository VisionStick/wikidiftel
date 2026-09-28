(() => {
  const TECHNICAL_TEXTS = [
    ['Experiencia Estudiantil conectada', 'Experiencia estudiantil'],
    ['EXPERIENCIA ESTUDIANTIL CONECTADA', 'EXPERIENCIA ESTUDIANTIL'],
    ['Los comentarios se guardan en Supabase y quedan asociados a la ficha del ramo. Al recargar la página siguen apareciendo.', 'Comparte tu experiencia de forma clara y respetuosa para orientar a futuras generaciones.'],
    ['No se pudieron cargar los comentarios desde Supabase.', 'No pudimos cargar los comentarios por ahora. Intenta nuevamente más tarde.'],
    ['No se pudo cargar la conexión con la base de datos.', 'No pudimos cargar los comentarios por ahora.'],
    ['No se encontró este ramo en la base de datos.', 'No encontramos comentarios asociados a este ramo.'],
    ['Cargando comentarios desde la base de datos...', 'Cargando comentarios...'],
    ['Comentario publicado y guardado en la base de datos.', 'Comentario publicado correctamente.']
  ];

  function textOf(node) {
    return (node?.innerText || node?.textContent || '').trim();
  }

  function replaceTechnicalText(root = document) {
    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      let value = node.nodeValue;
      let changed = false;
      TECHNICAL_TEXTS.forEach(([from, to]) => {
        if (value.includes(from)) {
          value = value.replaceAll(from, to);
          changed = true;
        }
      });
      if (changed) node.nodeValue = value;
    });
  }

  function hideLegacyExperienceForms() {
    const reviewRoot = document.querySelector('#supabase-course-reviews');
    const courseRoot = document.querySelector('#course-v4-root');
    if (!courseRoot) return;

    const candidates = [...courseRoot.querySelectorAll('section, article, form, div')]
      .filter((node) => {
        if (reviewRoot && (node === reviewRoot || node.contains(reviewRoot) || reviewRoot.contains(node))) return false;
        const text = textOf(node).toLowerCase();
        const hasLegacyTitle = text.includes('deja algo para la siguiente generación') || text.includes('cuenta tu experiencia');
        const hasLegacyFields = text.includes('contenido más difícil') || text.includes('consejo para aprobar') || text.includes('publicar como estudiante anónimo');
        const hasLocalHint = text.includes('github pages') || text.includes('localstorage') || text.includes('guardada en este navegador');
        return hasLegacyTitle || hasLegacyFields || hasLocalHint;
      })
      .sort((a, b) => textOf(a).length - textOf(b).length);

    candidates.slice(0, 4).forEach((node) => {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
      node.setAttribute('data-hidden-legacy-review', 'true');
    });
  }

  function normalizeReviewSection() {
    hideLegacyExperienceForms();
    replaceTechnicalText(document);

    const root = document.querySelector('#supabase-course-reviews');
    if (!root) return;

    const submit = root.querySelector('.db-review-submit');
    if (submit) submit.textContent = 'Publicar comentario';

    const helper = root.querySelector('.db-review-help');
    if (helper) helper.textContent = 'Evita publicar datos sensibles. Tu comentario será visible en la ficha de este ramo.';
  }

  function installSubmitFallback() {
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form?.id !== 'db-review-form') return;
      const textarea = form.querySelector('textarea[name="comment"]');
      const comment = textarea?.value?.trim() || '';
      if (comment.length < 20) {
        event.preventDefault();
        setTimeout(() => {
          const status = document.querySelector('#supabase-course-reviews .db-status');
          if (status) {
            status.classList.add('error');
            status.textContent = 'Escribe un comentario de al menos 20 caracteres.';
          }
        }, 50);
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    normalizeReviewSection();
    installSubmitFallback();

    const observer = new MutationObserver(normalizeReviewSection);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    setTimeout(normalizeReviewSection, 300);
    setTimeout(normalizeReviewSection, 900);
    setTimeout(normalizeReviewSection, 1800);
  });
})();
