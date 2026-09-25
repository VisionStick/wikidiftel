(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const themes = ['warm', 'light', 'dark'];
  const pathParts = location.pathname.split('/').filter(Boolean);
  const repoIndex = pathParts.indexOf('wikidiftel');
  const depth = repoIndex >= 0 ? Math.max(0, pathParts.length - repoIndex - 1) : pathParts.length;
  const base = depth ? '../'.repeat(depth) : './';

  function setTheme(theme) {
    const safeTheme = themes.includes(theme) ? theme : 'warm';
    document.documentElement.dataset.theme = safeTheme;
    localStorage.setItem('diftel-theme', safeTheme);
    $$('[data-set-theme]').forEach((button) => {
      button.classList.toggle('active', button.dataset.setTheme === safeTheme);
    });
  }

  setTheme(localStorage.getItem('diftel-theme') || document.documentElement.dataset.theme || 'warm');

  $$('[data-theme-picker]').forEach((picker) => {
    const trigger = $('[data-theme-trigger]', picker);
    trigger?.addEventListener('click', (event) => {
      event.stopPropagation();
      picker.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(picker.classList.contains('open')));
    });
    $$('[data-set-theme]', picker).forEach((button) => {
      button.addEventListener('click', () => {
        setTheme(button.dataset.setTheme);
        picker.classList.remove('open');
      });
    });
  });

  document.addEventListener('click', () => {
    $$('[data-theme-picker].open').forEach((picker) => picker.classList.remove('open'));
  });

  const menuButton = $('#mobile-menu-button');
  const mobileMenu = $('#mobile-menu');
  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const shouldOpen = mobileMenu.hasAttribute('hidden');
      if (shouldOpen) mobileMenu.removeAttribute('hidden');
      else mobileMenu.setAttribute('hidden', '');
      menuButton.setAttribute('aria-expanded', String(shouldOpen));
    });
    $$('a', mobileMenu).forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.setAttribute('hidden', '');
        menuButton.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function revealContent() {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = $$('.reveal');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -25px' });
    items.forEach((item) => observer.observe(item));
  }

  function ensureFixesCss() {
    if ($('link[data-diftel-fixes]')) return;
    const currentScript = document.currentScript?.src;
    if (!currentScript) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('fixes.css', currentScript).href;
    link.dataset.diftelFixes = '1';
    document.head.append(link);
  }

  function ensureFavicon() {
    const href = `${base}icon.png`;
    $$('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => link.remove());
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    icon.href = href;
    document.head.append(icon);
  }

  function cleanObsoleteLinks(root = document) {
    $$('a', root).forEach((link) => {
      const text = (link.textContent || '').trim().toLowerCase();
      const href = (link.getAttribute('href') || '').toLowerCase();
      if (href.includes('wiki-diftel.josnic.cl') || text === 'wiki ↗' || text.includes('wiki / apuntes') || text.includes('wiki diftel')) {
        link.remove();
        return;
      }
      if (text.includes('subir material') || text.includes('aportar material') || text === 'aportar') {
        link.textContent = 'Opinar en ramos';
        link.href = `${base}malla/`;
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    });
  }

  function renderFooter() {
    const footer = $('.site-footer');
    if (!footer) return;
    footer.innerHTML = `
      <div class="section-shell footer-main">
        <div class="footer-brand-block">
          <a href="${base}" class="footer-brand">
            <span class="brand-mark brand-mark-img" aria-hidden="true"><img src="${base}icon.png" alt="DIFTEL"></span>
            <span><strong>DIFTEL SJ</strong><small>San Joaquín</small></span>
          </a>
          <p>Hecho por estudiantes, para estudiantes. Una biblioteca viva de ramos, proyectos, talleres y recuerdos de Telemática.</p>
        </div>
        <div class="footer-column">
          <strong>Explorar</strong>
          <a href="${base}malla/">Malla</a>
          <a href="${base}proyectos/">Proyectos</a>
          <a href="${base}talleres/">Talleres</a>
          <a href="${base}comunidad/">Comunidad</a>
        </div>
        <div class="footer-column">
          <strong>Participar</strong>
          <a href="${base}malla/">Opinar en ramos</a>
        </div>
        <div class="footer-column">
          <strong>Redes</strong>
          <a target="_blank" rel="noopener" href="https://www.instagram.com/diftelusm/">@diftelusm</a>
          <a target="_blank" rel="noopener" href="https://instagram.com/telematicausm">@telematicausm</a>
          <a target="_blank" rel="noopener" href="https://www.instagram.com/ceetel.sj/">@ceetel.sj</a>
        </div>
      </div>
      <div class="section-shell footer-bottom">
        <span>© 2026 DIFTEL · Ingeniería Civil Telemática USM, Campus San Joaquín</span>
        <span>Contenido comunitario · verifica siempre información académica oficial.</span>
      </div>`;
  }

  function setupGlobalSearchShortcut() {
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        $('input[type="search"]')?.focus();
      }
      if (!isTyping && event.key === '/') {
        event.preventDefault();
        $('input[type="search"]')?.focus();
      }
    });
  }

  ensureFixesCss();
  ensureFavicon();
  revealContent();
  renderFooter();
  cleanObsoleteLinks();
  setupGlobalSearchShortcut();
})();
