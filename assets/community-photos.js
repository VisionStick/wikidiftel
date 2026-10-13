// Galería de comunidad: carrusel de fotos + visor ampliado.
//
// Cada slide reserva un lugar para una foto. Para publicar una foto real se
// reemplaza el <div class="photo-frame">…</div> por <img src="…" alt="…">.
// Con al menos una foto publicada el script agrega el visor: clic (o Enter)
// sobre la foto la abre a pantalla completa, con flechas, Esc para cerrar
// y gesto de deslizar en pantallas táctiles.
(() => {
  const init = (root) => {
    const track = root.querySelector('[data-carousel-track]');
    if (!track) return;
    const slides = [...track.querySelectorAll('.photo-slide')];
    if (!slides.length) return;
    const prevBtn = root.querySelector('[data-carousel-prev]');
    const nextBtn = root.querySelector('[data-carousel-next]');
    const dotsWrap = root.querySelector('[data-carousel-dots]');
    const status = root.querySelector('[data-carousel-status]');
    const counters = [...document.querySelectorAll('[data-photo-count]')];

    const trackLeft = () => track.getBoundingClientRect().left;
    const slideOffset = (i) => slides[i].getBoundingClientRect().left - trackLeft() + track.scrollLeft;
    const gap = () => parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 12;

    if (dotsWrap) {
      slides.forEach((slide, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';
        dot.setAttribute('aria-label', `Ir a la foto ${i + 1} de ${slides.length}`);
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.append(dot);
      });
    }
    const dots = dotsWrap ? [...dotsWrap.querySelectorAll('.carousel-dot')] : [];

    const goTo = (index) => {
      const safe = Math.max(0, Math.min(slides.length - 1, index));
      track.scrollTo({ left: slideOffset(safe), behavior: 'smooth' });
    };

    const step = () => slides[0].getBoundingClientRect().width + gap();
    const scrollBy = (amount) => track.scrollBy({ left: amount, behavior: 'smooth' });

    if (prevBtn) prevBtn.addEventListener('click', () => scrollBy(-step()));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollBy(step()));

    const current = () => {
      let best = 0;
      let bestDistance = Infinity;
      slides.forEach((slide, i) => {
        const distance = Math.abs(slide.getBoundingClientRect().left - trackLeft());
        if (distance < bestDistance) { bestDistance = distance; best = i; }
      });
      return best;
    };

    let frame = null;
    const sync = () => {
      const index = current();
      dots.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
      if (status) status.textContent = `Foto ${index + 1} de ${slides.length}`;
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 2;
      if (nextBtn) nextBtn.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };

    track.addEventListener('scroll', () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = null; sync(); });
    });

    track.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); scrollBy(step()); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); scrollBy(-step()); }
      if (event.key === 'Home') { event.preventDefault(); goTo(0); }
      if (event.key === 'End') { event.preventDefault(); goTo(slides.length - 1); }
    });

    if (counters.length) {
      const published = slides.filter((slide) => slide.querySelector('img')).length;
      const empty = slides.length - published;
      const text = published
        ? `${published} foto${published === 1 ? '' : 's'} · ${empty} espacio${empty === 1 ? '' : 's'} libre${empty === 1 ? '' : 's'}`
        : `${slides.length} espacios para fotos`;
      counters.forEach((counter) => { counter.textContent = text; });
    }

    setupViewer(slides);
    sync();
  };

  // Visor a pantalla completa. Solo se activa si hay fotos publicadas.
  function setupViewer(slides) {
    const photos = slides.filter((slide) => slide.querySelector('img'));
    if (!photos.length) return;

    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Foto ampliada');
    box.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Cerrar la foto">×</button>
      <button class="lightbox-arrow lightbox-prev" type="button" aria-label="Foto anterior">←</button>
      <figure class="lightbox-body">
        <img src="" alt="">
        <figcaption><strong></strong><span></span></figcaption>
      </figure>
      <button class="lightbox-arrow lightbox-next" type="button" aria-label="Foto siguiente">→</button>`;
    document.body.append(box);

    const image = box.querySelector('img');
    const title = box.querySelector('figcaption strong');
    const meta = box.querySelector('figcaption span');
    const closeBtn = box.querySelector('.lightbox-close');
    const prevBtn = box.querySelector('.lightbox-prev');
    const nextBtn = box.querySelector('.lightbox-next');
    let index = 0;
    let origin = null;

    const show = (step) => {
      index = (step + photos.length) % photos.length;
      const slide = photos[index];
      const img = slide.querySelector('img');
      image.src = img.currentSrc || img.src;
      image.alt = img.alt || '';
      title.textContent = slide.querySelector('.photo-caption strong')?.textContent || '';
      const date = slide.querySelector('.photo-meta')?.textContent || '';
      meta.textContent = photos.length > 1 ? `${date} · ${index + 1} de ${photos.length}` : date;
      prevBtn.hidden = nextBtn.hidden = photos.length < 2;
    };

    const open = (slide) => {
      origin = document.activeElement;
      show(photos.indexOf(slide));
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    };

    const close = () => {
      box.hidden = true;
      document.body.style.overflow = '';
      origin?.focus();
    };

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => show(index - 1));
    nextBtn.addEventListener('click', () => show(index + 1));
    box.addEventListener('click', (event) => { if (event.target === box) close(); });

    document.addEventListener('keydown', (event) => {
      if (box.hidden) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') show(index + 1);
      if (event.key === 'ArrowLeft') show(index - 1);
    });

    let startX = null;
    box.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (event) => {
      if (startX === null) return;
      const delta = event.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 50) show(index + (delta < 0 ? 1 : -1));
      startX = null;
    });

    slides.forEach((slide) => {
      if (!slide.querySelector('img')) return;
      const label = slide.querySelector('.photo-caption strong')?.textContent || 'foto';
      slide.classList.add('has-photo');
      slide.setAttribute('role', 'button');
      slide.setAttribute('tabindex', '0');
      slide.setAttribute('aria-label', `Ampliar foto: ${label}`);
      slide.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) return;
        open(slide);
      });
      slide.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(slide); }
      });
    });
  }

  document.querySelectorAll('[data-photo-carousel]').forEach(init);
})();
