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

  // Vista previa móvil: mantener presionado ~550 ms abre el tooltip sin navegar.
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

  // Pestañas de recursos por ramo.
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

  // Lightbox accesible básico para fotos de proyectos/talleres/comunidad.
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


  /* Correcciones visuales Pages: footer, filtros y fichas de ramo sin rediseñar la identidad del ZIP. */
  const scriptUrl = document.currentScript ? document.currentScript.src : '';
  if (scriptUrl && !document.querySelector('link[data-diftel-fixes]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('fixes.css', scriptUrl).href;
    link.dataset.diftelFixes = 'true';
    document.head.appendChild(link);
  }

  const pathBits = location.pathname.split('/').filter(Boolean);
  const repoAt = pathBits.indexOf('wikidiftel');
  const depth = repoAt >= 0 ? Math.max(0, pathBits.length - repoAt - 1) : pathBits.length;
  const relRoot = depth === 0 ? './' : '../'.repeat(depth);

  function normalizeFooter() {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;
    footer.innerHTML = `
      <div class="section-shell footer-main">
        <div class="footer-brand-block">
          <a href="${relRoot}" class="footer-brand"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M13.4 2.7 5.7 13h5.1l-.2 8.3L18.3 11h-5.1l.2-8.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span><span><strong>DIFTEL SJ</strong><small>San Joaquín</small></span></a>
          <p>Hecho por estudiantes, para estudiantes. Una biblioteca viva de ramos, proyectos, talleres y recuerdos de Telemática.</p>
        </div>
        <div class="footer-column"><strong>Explorar</strong><a href="${relRoot}malla/">Malla</a><a href="${relRoot}proyectos/">Proyectos</a><a href="${relRoot}talleres/">Talleres</a><a href="${relRoot}comunidad/">Comunidad</a></div>
        <div class="footer-column"><strong>Aportar</strong><a href="${relRoot}buzon/">Subir material</a><a target="_blank" rel="noopener" href="https://wiki-diftel.josnic.cl/share/x82bmjt0f4/p/biblioteca-diftel-iINlC7wT9n">Wiki DIFTEL ↗</a></div>
        <div class="footer-column"><strong>Redes</strong><a target="_blank" rel="noopener" href="https://www.instagram.com/diftelusm/">@diftelusm</a><a target="_blank" rel="noopener" href="https://instagram.com/telematicausm">@telematicausm</a><a target="_blank" rel="noopener" href="https://www.instagram.com/ceetel.sj/">@ceetel.sj</a></div>
      </div>
      <div class="section-shell footer-bottom"><span>© 2026 DIFTEL · Ingeniería Civil Telemática USM, Campus San Joaquín</span><span>Contenido comunitario · verifica siempre información académica oficial.</span></div>`;
  }
  normalizeFooter();

  mobileMenu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mobileMenu.setAttribute('hidden', '');
    menuButton?.setAttribute('aria-expanded', 'false');
  }));

  const yearOptions = '<option value="all">Todos los años</option><option>2019</option><option>2020</option><option>2021</option><option>2022</option><option>2023</option><option>2024</option><option>2025</option><option>2026</option>';
  const projectsTypes = '<option value="all">Todos los proyectos</option><option value="diftel">Proyectos de DIFTEL</option><option value="telematica">Proyectos de Telemática</option><option value="ramo">Proyectos por ramo</option><option value="mechones">Proyectos de mechones</option>';
  const workshopTypes = '<option value="all">Todos los tipos</option><option value="taller">Taller</option><option value="charla">Charla</option><option value="conferencia">Conferencia</option><option value="hackathon">Hackathon</option><option value="otro">Otro</option>';
  function filterForm(scope, placeholder, types) {
    return `<section class="section-shell filters-panel filters-panel-wide reveal is-visible"><form class="filters-form enhanced-filters" data-filter-form data-filter-scope="${scope}"><div class="filter-search"><svg viewBox="0 0 24 24"><path d="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" stroke-width="2"/></svg><input type="search" name="q" placeholder="${placeholder}" data-filter-search></div><select data-filter-type>${types}</select><select data-filter-year>${yearOptions}</select><button class="button button-primary small" type="submit">Filtrar</button><button class="clear-filter" type="reset">Limpiar</button></form></section>`;
  }
  function enhanceFilters() {
    const main = document.querySelector('main');
    if (!main) return;
    if (location.pathname.includes('/proyectos/') && !main.querySelector('[data-filter-form]')) {
      document.querySelector('.category-switch')?.insertAdjacentHTML('afterend', filterForm('projects', 'Buscar por nombre, ramo, palabra clave…', projectsTypes));
      const empty = main.querySelector('.projects-wrap .empty-state');
      if (empty) { empty.id = 'projects-empty'; empty.querySelector('h2') && (empty.querySelector('h2').textContent = 'No encontramos proyectos con esos filtros.'); empty.querySelector('p') && (empty.querySelector('p').textContent = 'Prueba con otra búsqueda o vuelve a ver todo el archivo.'); empty.insertAdjacentHTML('beforeend','<button class="button button-soft small" type="button" data-reset-filters>Ver todos</button>'); }
    }
    if (location.pathname.includes('/talleres/') && !main.querySelector('[data-filter-form]')) {
      document.querySelector('.workshop-browser')?.insertAdjacentHTML('beforebegin', filterForm('workshops', 'Buscar taller, organización o tema…', workshopTypes));
      const empty = main.querySelector('.workshop-browser .empty-state');
      if (empty) { empty.id = 'workshops-empty'; empty.querySelector('h2') && (empty.querySelector('h2').textContent = 'No hay talleres con esos filtros.'); empty.querySelector('p') && (empty.querySelector('p').textContent = 'Prueba otro año o vuelve al archivo completo.'); empty.insertAdjacentHTML('beforeend','<button class="button button-soft small" type="button" data-reset-filters>Ver todos</button>'); }
    }
    if (location.pathname.includes('/comunidad/') && !main.querySelector('.community-controls')) {
      const chips = ['Todo','Proyectos','Talleres y charlas','Ferias y muestras','Bienvenidas y mechoneos','Vida académica','Comunidad y vida estudiantil','Otros recuerdos'].map((x,i)=>`<button class="chip ${i?'':'active'}" type="button" data-community-category>${x}</button>`).join('');
      document.querySelector('#archivo')?.insertAdjacentHTML('beforebegin', `<section class="section-shell community-controls reveal is-visible"><div class="chip-filters">${chips}<select aria-label="Filtrar por año">${yearOptions.replace('Todos los años','Cualquier año')}</select></div></section>`);
      const people = document.querySelector('.people-section .section-heading');
      if (people && !document.querySelector('.directory-search')) people.insertAdjacentHTML('afterend', `<form class="filters-panel directory-search"><div class="filter-search"><input type="search" placeholder="Buscar por nombre, área, rol…"></div><select><option>Todas las generaciones</option><option>2019</option><option>2020</option><option>2021</option><option>2022</option><option>2023</option><option>2024</option><option>2025</option><option>2026</option></select><button class="button button-primary small" type="submit">Buscar</button></form>`);
      document.querySelectorAll('[data-community-category]').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('[data-community-category]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }));
    }
  }
  enhanceFilters();

  function applyStaticFiltering() {
    document.querySelectorAll('[data-filter-form]').forEach(form => {
      const scope = form.dataset.filterScope || '';
      const box = form.closest('main') || document;
      const cards = Array.from(box.querySelectorAll('[data-filter-card]'));
      const empty = box.querySelector(`#${scope}-empty`) || box.querySelector('.empty-state');
      const apply = () => {
        const q = (form.querySelector('[data-filter-search]')?.value || '').trim().toLowerCase();
        const type = form.querySelector('[data-filter-type]')?.value || 'all';
        const year = form.querySelector('[data-filter-year]')?.value || 'all';
        let visible = 0;
        cards.forEach(card => {
          const hay = (card.dataset.search || card.textContent || '').toLowerCase();
          const ok = (!q || hay.includes(q)) && (type === 'all' || (card.dataset.type || '').split(' ').includes(type)) && (year === 'all' || card.dataset.year === year);
          card.hidden = !ok; if (ok) visible++;
        });
        if (empty) empty.hidden = cards.length > 0 && visible > 0;
      };
      form.addEventListener('submit', e => { e.preventDefault(); apply(); });
      form.addEventListener('input', apply); form.addEventListener('change', apply); form.addEventListener('reset', () => setTimeout(apply, 0));
      box.querySelectorAll('[data-reset-filters]').forEach(b => b.addEventListener('click', () => { form.reset(); apply(); }));
      box.querySelectorAll('[data-quick-filter]').forEach(b => b.addEventListener('click', () => { const s = form.querySelector('[data-filter-type]'); if (s) s.value = b.dataset.quickFilter || 'all'; box.querySelectorAll('[data-quick-filter]').forEach(x => x.classList.toggle('is-active', x === b)); apply(); }));
      apply();
    });
  }
  applyStaticFiltering();

  const courses = [
    ['HXW006','Comunicación efectiva en español / inglés I',1,'Formación transversal','hxw006-comunicacion-efectiva-en-espanol-ingles-i'],['EFI200','Educación Física I',1,'Formación transversal','efi200-educacion-fisica-i'],['IWG400','Proyecto Inicial',1,'Proyectos','iwg400-proyecto-inicial'],['FIS100','Introducción a la Física',1,'Ciencias básicas','fis100-introduccion-a-la-fisica'],['MAT070','Introducción al Cálculo',1,'Matemática','mat070-introduccion-al-calculo'],['MAT060','Álgebra y Geometría',1,'Matemática','mat060-algebra-y-geometria'],
    ['HXW007','Comunicación efectiva en español / inglés II',2,'Formación transversal','hxw007-comunicacion-efectiva-en-espanol-ingles-ii'],['EFI201','Educación Física II',2,'Formación transversal','efi201-educacion-fisica-ii'],['INF129','Introducción a la Programación',2,'Programación','inf129-introduccion-a-la-programacion'],['RAMO','Física General Mecánica',2,'Ciencias básicas','fisica-general-mecanica-s2'],['MAT071','Cálculo en una Variable',2,'Matemática','mat071-calculo-en-una-variable'],['MAT061','Álgebra Lineal',2,'Matemática','mat061-algebra-lineal'],
    ['RAMO','Análisis Crítico de Texto',3,'Formación transversal','analisis-critico-de-texto-s3'],['RAMO','Redes de Computadores',3,'Redes','redes-de-computadores-s3'],['RAMO','Seminario de Programación',3,'Programación','seminario-de-programacion-s3'],['RAMO','Electricidad y Magnetismo',3,'Ciencias básicas','electricidad-y-magnetismo-s3'],['RAMO','Cálculo en Varias Variables',3,'Matemática','calculo-en-varias-variables-s3'],['RAMO','Ecuaciones Diferenciales Elementales',3,'Matemática','ecuaciones-diferenciales-elementales-s3'],
    ['RAMO','Comunicación efectiva en español / inglés III',4,'Formación transversal','comunicacion-efectiva-en-espanol-ingles-iii-s4'],['RAMO','Electrónica Digital',4,'Electrónica','electronica-digital-s4'],['RAMO','Algorítmica y Complejidad',4,'Programación','algoritmica-y-complejidad-s4'],['RAMO','Laboratorio de Redes de Computadores',4,'Redes','laboratorio-de-redes-de-computadores-s4'],['RAMO','Laboratorio de Electrónica Digital',4,'Electrónica','laboratorio-de-electronica-digital-s4'],['RAMO','Calor y Ondas',4,'Ciencias básicas','calor-y-ondas-s4'],
    ['RAMO','Práctica de Acción Comunitaria',5,'Formación transversal','practica-de-accion-comunitaria-s5'],['RAMO','Administración y Sostenibilidad Organizacional',5,'Gestión','administracion-y-sostenibilidad-organizacional-s5'],['RAMO','Administración de Redes',5,'Redes','administracion-de-redes-s5'],['RAMO','Sistemas Digitales y Estructura Computadores',5,'Electrónica','sistemas-digitales-y-estructura-computadores-s5'],['RAMO','Base de Datos',5,'Programación','base-de-datos-s5'],['RAMO','Fundamentos de Transmisión Señales',5,'Telecomunicaciones','fundamentos-de-transmision-senales-s5'],
    ['RAMO','Comunicación efectiva en español / inglés IV',6,'Formación transversal','comunicacion-efectiva-en-espanol-ingles-iv-s6'],['RAMO','Ingeniería Económica',6,'Gestión','ingenieria-economica-s6'],['RAMO','Análisis y Diseño de Software',6,'Programación','analisis-y-diseno-de-software-s6'],['RAMO','Sistemas Operativos',6,'Programación','sistemas-operativos-s6'],['RAMO','Estadística Computacional',6,'Matemática','estadistica-computacional-s6'],['RAMO','Principios de Comunicaciones',6,'Telecomunicaciones','principios-de-comunicaciones-s6'],
    ['RAMO','Inglés Disciplinar',7,'Formación transversal','ingles-disciplinar-s7'],['RAMO','Disponibilidad y Rendimiento de Sistemas TIC',7,'Redes','disponibilidad-y-rendimiento-de-sistemas-tic-s7'],['RAMO','Ingeniería de Software',7,'Programación','ingenieria-de-software-s7'],['RAMO','Laboratorio de Comunicaciones',7,'Telecomunicaciones','laboratorio-de-comunicaciones-s7'],['RAMO','Optimización',7,'Matemática','optimizacion-s7'],['RAMO','Ciencia de Datos',7,'Datos','ciencia-de-datos-s7'],
    ['RAMO','Electivo',8,'Electivos','electivo-s8'],['RAMO','Pensamiento de Diseño de Ingeniería',8,'Proyectos','pensamiento-de-diseno-de-ingenieria-s8'],['RAMO','Ingeniería en Ciberseguridad',8,'Ciberseguridad','ingenieria-en-ciberseguridad-s8'],['RAMO','Planificación de Infraestructura Telemática',8,'Redes','planificacion-de-infraestructura-telematica-s8'],['RAMO','Aplicaciones Web y Móviles',8,'Programación','aplicaciones-web-y-moviles-s8'],['RAMO','Procesamiento Digital de Imágenes',8,'Datos','procesamiento-digital-de-imagenes-s8'],
    ['RAMO','Electivo',9,'Electivos','electivo-s9'],['RAMO','Gestión de la Innovación',9,'Gestión','gestion-de-la-innovacion-s9'],['RAMO','Electivo Disciplinar I',9,'Electivos','electivo-disciplinar-i-s9'],['RAMO','Electivo Disciplinar II',9,'Electivos','electivo-disciplinar-ii-s9'],['RAMO','Electivo Disciplinar III',9,'Electivos','electivo-disciplinar-iii-s9'],['RAMO','Taller Memoria I',9,'Titulación','taller-memoria-i-s9'],
    ['RAMO','Electivo Disciplinar IV',10,'Electivos','electivo-disciplinar-iv-s10'],['RAMO','Gestión del Emprendimiento',10,'Gestión','gestion-del-emprendimiento-s10'],['RAMO','Electivo Disciplinar V',10,'Electivos','electivo-disciplinar-v-s10'],['RAMO','Electivo Disciplinar VI',10,'Electivos','electivo-disciplinar-vi-s10'],['RAMO','Taller Memoria II',10,'Titulación','taller-memoria-ii-s10']
  ].map(([code,name,sem,area,slug]) => ({code,name,sem,area,slug,summary:`Ficha colaborativa de ${name}. DIFTEL puede centralizar aquí apuntes, evaluaciones históricas, material de estudio y experiencias de estudiantes.`}));
  const progression = [['FIS100','MAT070','IWG400'],['HXW006','HXW007','Comunicación efectiva en español / inglés III','Comunicación efectiva en español / inglés IV','Inglés Disciplinar'],['EFI200','EFI201'],['MAT060','MAT061','Cálculo en Varias Variables','Ecuaciones Diferenciales Elementales','Estadística Computacional','Optimización'],['FIS100','Física General Mecánica','Electricidad y Magnetismo','Calor y Ondas','Fundamentos de Transmisión Señales','Principios de Comunicaciones','Laboratorio de Comunicaciones'],['INF129','Seminario de Programación','Algorítmica y Complejidad','Base de Datos','Análisis y Diseño de Software','Ingeniería de Software','Aplicaciones Web y Móviles']];
  const findCourse = q => courses.find(c => c.slug === q || c.code === q || c.name.toLowerCase() === String(q||'').toLowerCase()) || courses[0];
  const prevNext = course => {
    const previous = [], next = [];
    progression.forEach(chain => chain.forEach((item, i) => { if (item === course.code || item === course.name) { if (i>0) previous.push(findCourse(chain[i-1])); if (i<chain.length-1) next.push(findCourse(chain[i+1])); } }));
    return {previous, next};
  };
  function rewriteMallaLinks() {
    if (!location.pathname.includes('/malla/')) return;
    const tiles = document.querySelectorAll('.course-tile');
    tiles.forEach(tile => {
      const code = tile.querySelector('.course-tile-top span')?.textContent?.trim();
      const name = tile.querySelector('h2')?.textContent?.trim();
      const course = courses.find(c => (code && code !== 'RAMO' && c.code === code) || c.name === name);
      if (course) tile.href = `../ramo/?q=${encodeURIComponent(course.slug)}`;
    });
  }
  rewriteMallaLinks();

  function renderCoursePage() {
    const mount = document.querySelector('[data-course-page]');
    if (!mount) return;
    const course = findCourse(new URLSearchParams(location.search).get('q'));
    const pn = prevNext(course);
    const side = (items, empty, cls) => `<div class="progression-side ${cls}"><small>${cls==='prev'?'Ramos previos':'Ramo siguiente'}</small>${items.length ? items.slice(0,2).map(x=>`<a href="?q=${encodeURIComponent(x.slug)}"><span>${cls==='prev'?'←':''}</span><div><strong>${x.code}</strong><p>${x.name}</p></div><span>${cls==='next'?'→':''}</span></a>`).join('') : `<p class="progression-empty">${empty}</p>`}</div>`;
    mount.innerHTML = `<section class="course-hero section-shell reveal is-visible"><a class="back-link" href="../malla/">← Volver a la malla</a><span class="eyebrow">${course.code}</span><div class="course-hero-grid"><div><h1>${course.name}</h1><p class="detail-lead">${course.summary}</p><div class="tag-row spacious"><span>Semestre ${course.sem}</span><span>${course.area}</span><span>Plan 2025</span></div></div><aside class="course-quick-card"><small>Ficha colaborativa</small><strong>${course.code}</strong><p>Recursos, experiencias y consejos para orientar a la siguiente generación.</p></aside></div></section><section class="section-shell course-main-layout"><div class="course-main-column"><div class="progression-context"><span>✦</span><p>Esta navegación muestra relaciones editoriales de continuidad, no reemplaza prerequisitos oficiales.</p></div><div class="progression-strip">${side(pn.previous,'No hay ramo indicado previamente.','prev')}<div class="progression-current"><span>Estás aquí</span><strong>${course.code}</strong><p>${course.name}</p></div>${side(pn.next,'No hay ramo siguiente indicado todavía.','next')}</div><section class="detail-section course-summary"><span class="eyebrow">Resumen del ramo</span><h2>¿De qué se trata?</h2><p>${course.summary}</p></section><section class="detail-section"><span class="eyebrow">Biblioteca del ramo</span><h2>Material organizado por año y semestre</h2><p>Para que encontrar un certamen de 2025-2 no implique recorrer veinte carpetas.</p><div class="resource-tabs" data-resource-tabs><div class="resource-tab-list"><button class="active" type="button" data-resource-tab="apuntes">Apuntes</button><button type="button" data-resource-tab="certamenes">Certámenes anteriores</button><button type="button" data-resource-tab="controles">Controles anteriores</button><button type="button" data-resource-tab="material">Material de estudio</button></div><div class="resource-panel active"><div class="resource-empty"><span>✦</span><p>Aún no hay material cargado. Si tienes apuntes, súbelos desde el buzón.</p></div></div></div></section><section class="detail-section"><span class="eyebrow">Experiencia estudiantil</span><h2>Lo que cuentan quienes ya lo cursaron</h2><div class="rating-overview"><div><small>Dificultad</small><strong>—</strong></div><div><small>Carga de trabajo</small><strong>—</strong></div><div><small>Utilidad</small><strong>—</strong></div><div><small>Estudio semanal</small><strong>—</strong><span>0 opiniones publicadas</span></div></div></section></div><aside class="course-side-column"><form class="opinion-form"><span class="eyebrow">Deja algo para la siguiente generación</span><h2>Cuenta tu experiencia</h2><p>No hace falta escribir una reseña perfecta. Lo útil es ser concreto y aportar contexto.</p><label>Año en que lo cursaste<input type="number" min="2019" max="2026" placeholder="2026"></label><label>Profesor/a<input type="text" placeholder="Nombre del/la docente"></label><div class="rating-fields"><label>Dificultad<select><option>—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Carga<select><option>—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Utilidad<select><option>—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div><label>Tu experiencia<textarea placeholder="¿Cómo se sintió realmente cursar este ramo?"></textarea></label><label>Consejo para aprobar<textarea placeholder="Algo que te habría gustado saber antes"></textarea></label><label class="check"><input type="checkbox" checked> Publicar como estudiante anónimo</label><button class="button button-primary" type="button">Enviar para revisión</button><small class="form-note">En GitHub Pages el formulario es visual; los aportes reales se conectan con la app dinámica.</small></form></aside></section>`;
  }
  renderCoursePage();
})();
