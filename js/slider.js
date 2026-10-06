// slider.js — one-slide-at-a-time photo carousels (.blk-gallery-slider) with dots + arrows.
document.querySelectorAll('.blk-gallery-slider').forEach((s) => {
  const slides = [...s.children];
  if (slides.length < 2) return;
  const wrap = document.createElement('div');
  wrap.className = 'blk-slider';
  s.parentNode.insertBefore(wrap, s);
  wrap.appendChild(s);
  const mk = (cls, label, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-label', label); b.textContent = txt; return b; };
  const prev = mk('blk-slider-btn prev', 'Previous photo', '‹');
  const next = mk('blk-slider-btn next', 'Next photo', '›');
  const dots = document.createElement('div'); dots.className = 'blk-slider-dots';
  const dotEls = slides.map((_, i) => { const d = mk('blk-slider-dot', `Photo ${i + 1}`, ''); d.addEventListener('click', () => go(i)); dots.appendChild(d); return d; });
  wrap.append(prev, next, dots);
  const idx = () => Math.round(s.scrollLeft / s.clientWidth);
  const go = (i) => s.scrollTo({ left: Math.max(0, Math.min(slides.length - 1, i)) * s.clientWidth, behavior: 'smooth' });
  const sync = () => dotEls.forEach((d, i) => d.classList.toggle('on', i === idx()));
  prev.addEventListener('click', () => go(idx() - 1));
  next.addEventListener('click', () => go(idx() + 1));
  s.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  sync();
});
