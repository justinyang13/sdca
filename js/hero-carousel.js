// hero-carousel.js — accessible auto-advancing hero carousel (Phase 8).
// Progressive enhancement: without JS the first slide is already visible
// (see partial hero-carousel.ejs). With JS: 6s auto-advance, pause on
// hover/focus-within, swipe on touch, prev/next arrows, dot indicators,
// keyboard (arrow keys when focused), prefers-reduced-motion respected.
(function () {
  'use strict';

  const INTERVAL_MS = 6000;

  function attach(root) {
    const slides = Array.from(root.querySelectorAll('[data-carousel-slides] > .hero-carousel-slide'));
    const prevBtn = root.querySelector('[data-carousel-prev]');
    const nextBtn = root.querySelector('[data-carousel-next]');
    const dots = Array.from(root.querySelectorAll('[data-carousel-dot]'));
    if (slides.length < 2) return; // nothing to rotate

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    let timer = null;
    let paused = false;

    function show(idx) {
      current = ((idx % slides.length) + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('is-current', i === current));
      dots.forEach((d, i) => {
        d.classList.toggle('is-active', i === current);
        d.setAttribute('aria-selected', String(i === current));
      });
    }
    function next() { show(current + 1); }
    function prev() { show(current - 1); }

    function start() {
      if (reduceMotion || paused) return;
      stop();
      timer = setInterval(next, INTERVAL_MS);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { prev(); start(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { next(); start(); });
    dots.forEach((d, i) => d.addEventListener('click', () => { show(i); start(); }));

    // Pause on hover / focus anywhere in the carousel
    root.addEventListener('mouseenter', () => { paused = true; stop(); });
    root.addEventListener('mouseleave', () => { paused = false; start(); });
    root.addEventListener('focusin', () => { paused = true; stop(); });
    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget)) { paused = false; start(); }
    });

    // Keyboard: arrow keys when focus is within the carousel
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); start(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); start(); }
      else if (e.key === 'Home') { e.preventDefault(); show(0); start(); }
      else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); start(); }
    });

    // Touch / pointer swipe
    let startX = null;
    root.addEventListener('pointerdown', (e) => { startX = e.clientX; }, { passive: true });
    root.addEventListener('pointerup', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); start(); }
      startX = null;
    }, { passive: true });

    // Respect reduced-motion changes at runtime
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.addEventListener) mq.addEventListener('change', (ev) => {
      if (ev.matches) stop(); else start();
    });

    show(0);
    start();
  }

  function init() {
    document.querySelectorAll('[data-carousel]').forEach(attach);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
