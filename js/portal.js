// portal.js — the registration portal pages are static: forms never submit.
document.querySelectorAll('form[data-static]').forEach((f) => {
  f.addEventListener('submit', (e) => e.preventDefault());
});
