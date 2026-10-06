// lightbox.js — minimal image lightbox with keyboard + prev/next
(() => {
  const lb = document.querySelector('.lightbox');
  if (!lb) return;

  const img = lb.querySelector('img');
  const caption = lb.querySelector('.lb-caption');
  const closeBtn = lb.querySelector('.lb-close');
  const prevBtn = lb.querySelector('.lb-prev');
  const nextBtn = lb.querySelector('.lb-next');

  let items = [];
  let idx = 0;

  function render() {
    const it = items[idx];
    if (!it) return;
    img.src = it.src;
    img.alt = it.alt || '';
    caption && (caption.textContent = it.caption || '');
  }
  function open(startIdx) {
    idx = startIdx || 0;
    render();
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn && closeBtn.focus();
  }
  function close() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    const last = document.activeElement;
    last instanceof HTMLElement && last.focus();
  }
  function next() { idx = (idx + 1) % items.length; render(); }
  function prev() { idx = (idx - 1 + items.length) % items.length; render(); }

  // Wire up trigger items (a[data-lightbox])
  document.querySelectorAll('a[data-lightbox]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const group = a.dataset.lightbox;
      items = Array.from(document.querySelectorAll(`a[data-lightbox="${group}"]`)).map((el) => ({
        src: el.dataset.full || el.href,
        alt: el.getAttribute('aria-label') || el.textContent.trim(),
        caption: el.dataset.caption || '',
      }));
      open(items.findIndex((it) => it.src === (a.dataset.full || a.href)));
    });
  });

  closeBtn && closeBtn.addEventListener('click', close);
  nextBtn && nextBtn.addEventListener('click', next);
  prevBtn && prevBtn.addEventListener('click', prev);
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });
})();

// Hero thumbnail strip on /media — clicking a thumbnail opens it in the lightbox.
document.querySelectorAll('a[data-thumb]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (!lb) return;
    e.preventDefault();
    const base = a.dataset.thumb;
    const alt = a.dataset.alt || '';
    const src = `/img/${base}-1600.jpg`;
    items = [{ src, alt, caption: alt }];
    open(0);
    document.querySelectorAll('a[data-thumb]').forEach((x) => x.classList.toggle('is-active', x === a));
  });
});
