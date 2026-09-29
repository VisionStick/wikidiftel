(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const themes = ['warm', 'light', 'dark'];
  const pathParts = location.pathname.split('/').filter(Boolean);
  const repoIndex = pathParts.indexOf('wikidiftel');
  const depth = repoIndex >= 0 ? Math.max(0, pathParts.length - repoIndex - 1) : pathParts.length;
  const base = depth ? '../'.repeat(depth) : './';
  const brandLogoSrc = `${base}diftel-logo.png`;

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


  // Footer mini de una línea: marca + copyright + RRSS (la navegación ya está arriba).
  function renderFooter() {
    const footer = $('.site-footer');
    if (!footer) return;
    footer.innerHTML = `
      <div class="section-shell footer-mini">
        <a class="footer-brand" href="${base}" aria-label="DIFTEL SJ, volver al inicio"><span class="footer-brand-mark"><img src="${brandLogoSrc}" alt="DIFTEL"></span><strong>DIFTEL SJ</strong></a>
        <span class="footer-copy">© 2026 DIFTEL SJ · Todos los derechos reservados</span>
        <nav class="footer-socials" aria-label="Redes sociales">
          <a target="_blank" rel="noopener" href="https://www.instagram.com/diftelusm/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg><span>@diftelusm</span></a>
          <a target="_blank" rel="noopener" href="https://instagram.com/telematicausm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg><span>@telematicausm</span></a>
          <a target="_blank" rel="noopener" href="https://www.instagram.com/ceetel.sj/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg><span>@ceetel.sj</span></a>
          <a target="_blank" rel="noopener" href="https://www.tiktok.com/@diftel.sj"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 8.5v8.3a2.8 2.8 0 1 0 2.8-2.8"/><path d="M9.5 8.5c.6 2.6 2.4 4 5.2 4.2V9.6c-.9 0-1.9-.3-2.7-.9"/><path d="M9.5 5v3.5"/></svg><span>@diftel.sj</span></a>
        </nav>
      </div>`;
  }

  function setupPreviewCards() {
    $('[data-preview-card]').forEach((card) => {
      let holdTimer = null;
      let openedByHold = false;
      const closeTimer = () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
      };
      card.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') return;
        openedByHold = false;
        holdTimer = setTimeout(() => {
          openedByHold = true;
          $('.preview-open').forEach((other) => { if (other !== card) other.classList.remove('preview-open'); });
          card.classList.add('preview-open');
          if (navigator.vibrate) navigator.vibrate(18);
        }, 550);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => card.addEventListener(name, closeTimer));
      card.addEventListener('click', (event) => {
        if (openedByHold || card.classList.contains('preview-open')) {
          event.preventDefault();
          card.classList.remove('preview-open');
          openedByHold = false;
        }
      });
    });
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
  revealContent();
  renderFooter();
  setupPreviewCards();
  setupGlobalSearchShortcut();
})();
