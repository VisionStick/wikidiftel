(() => {
  const root = document.documentElement;
  const validThemes = ['warm', 'light', 'dark'];

  function setTheme(theme) {
    if (!validThemes.includes(theme)) return;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('diftel-theme', theme);
    document.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.setTheme === theme);
    });
  }

  setTheme(root.getAttribute('data-theme') || 'warm');

  document.querySelectorAll('[data-theme-picker]').forEach(picker => {
    const trigger = picker.querySelector('[data-theme-trigger]');
    trigger?.addEventListener('click', e => {
      e.stopPropagation();
      const open = picker.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
    });
    picker.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.setTheme);
        picker.classList.remove('open');
        trigger?.setAttribute('aria-expanded', 'false');
      });
    });
  });
  document.addEventListener('click', () => document.querySelectorAll('[data-theme-picker].open').forEach(picker => {
    picker.classList.remove('open');
    picker.querySelector('[data-theme-trigger]')?.setAttribute('aria-expanded', 'false');
  }));

  const menuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const opening = mobileMenu.hasAttribute('hidden');
      if (opening) mobileMenu.removeAttribute('hidden'); else mobileMenu.setAttribute('hidden', '');
      menuButton.setAttribute('aria-expanded', String(opening));
    });
  }

  // Búsqueda rápida desde cualquier parte del portal: Ctrl/Cmd + K o “/”.
  const focusGlobalSearch = () => {
    const desktopInput = document.querySelector('.desktop-search [data-global-search-input]');
    const mobileInput = document.querySelector('.mobile-search [data-global-search-input]');
    const target = desktopInput && window.getComputedStyle(desktopInput).display !== 'none' ? desktopInput : mobileInput;
    if (target) {
      target.focus();
      target.select?.();
    }
  };
  document.addEventListener('keydown', event => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const typing = ['input','textarea','select'].includes(tag) || document.activeElement?.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      focusGlobalSearch();
      return;
    }
    if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      focusGlobalSearch();
    }
  });

  // Al navegar desde el menú móvil, se cierra para no dejar una capa abierta al volver atrás.
  document.querySelectorAll('#mobile-menu a').forEach(link => link.addEventListener('click', () => {
    mobileMenu?.setAttribute('hidden', '');
    menuButton?.setAttribute('aria-expanded', 'false');
  }));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08, rootMargin: '0px 0px -25px' });
    revealEls.forEach(el => observer.observe(el));
  }

  document.querySelectorAll('[data-preview-card]').forEach(card => {
    let timer = null;
    let openedByHold = false;
    const clear = () => { if (timer) clearTimeout(timer); timer = null; };
    card.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') return;
      openedByHold = false;
      timer = setTimeout(() => {
        openedByHold = true;
        card.classList.add('preview-open');
        if (navigator.vibrate) navigator.vibrate(20);
      }, 550);
    });
    ['pointerup','pointercancel','pointerleave'].forEach(name => card.addEventListener(name, clear));
    card.addEventListener('click', event => {
      if (openedByHold || card.classList.contains('preview-open')) {
        event.preventDefault();
        card.classList.remove('preview-open');
        openedByHold = false;
      }
    });
  });

  document.querySelectorAll('[data-resource-tabs]').forEach(group => {
    const buttons = group.querySelectorAll('[data-resource-tab]');
    const panels = group.querySelectorAll('[data-resource-panel]');
    const activate = (button) => {
      const key = button.dataset.resourceTab;
      buttons.forEach(b => {
        const selected = b === button;
        b.classList.toggle('active', selected);
        b.setAttribute('aria-selected', String(selected));
        b.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(panel => {
        const selected = panel.dataset.resourcePanel === key;
        panel.classList.toggle('active', selected);
        panel.hidden = !selected;
      });
    };
    buttons.forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === 0));
      button.tabIndex = index === 0 ? 0 : -1;
      button.addEventListener('click', () => activate(button));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const current = Array.from(buttons).indexOf(button);
        let next = current;
        if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        activate(buttons[next]);
        buttons[next].focus();
      });
    });
    panels.forEach((panel, index) => { panel.hidden = index !== 0; });
  });

  const lightbox = document.getElementById('site-lightbox');
  if (lightbox) {
    const image = lightbox.querySelector('[data-lightbox-image]');
    const caption = lightbox.querySelector('[data-lightbox-caption]');
    const close = () => { lightbox.setAttribute('hidden',''); document.body.style.overflow = ''; };
    document.querySelectorAll('[data-lightbox-src]').forEach(button => button.addEventListener('click', () => {
      image.src = button.dataset.lightboxSrc || '';
      image.alt = button.dataset.lightboxCaption || '';
      caption.textContent = button.dataset.lightboxCaption || '';
      lightbox.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      lightbox.querySelector('[data-lightbox-close]')?.focus();
    }));
    lightbox.querySelector('[data-lightbox-close]')?.addEventListener('click', close);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lightbox.hasAttribute('hidden')) close(); });
  }
})();
