// forms.js — progressive-enhancement UX for forms (server still validates)
(() => {
  document.querySelectorAll('form[data-enhance]').forEach((form) => {
    const fields = form.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea');
    fields.forEach((el) => {
      el.addEventListener('blur', () => {
        const rule = el.required && !el.value.trim();
        if (rule) {
          el.classList.add('invalid');
          const err = form.querySelector(`[data-error-for="${el.name}"]`);
          if (err) {
            err.hidden = false;
            err.textContent = el.getAttribute('data-required-msg') || '';
            el.setAttribute('aria-describedby', err.id);
          }
        }
      });
      el.addEventListener('input', () => {
        if (el.classList.contains('invalid') && el.value.trim()) {
          el.classList.remove('invalid');
          const err = form.querySelector(`[data-error-for="${el.name}"]`);
          if (err) err.hidden = true;
        }
      });
    });
  });
})();
