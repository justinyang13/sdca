// tabs.js — accessible filter tabs with progressive enhancement
(() => {
  document.querySelectorAll('[data-tabs]').forEach((container) => {
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const panels = Array.from(container.querySelectorAll('[role="tabpanel"]'));
    if (!tabs.length) return;

    function activate(tab, focus = true) {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((p) => {
        p.hidden = p.getAttribute('aria-labelledby') !== tab.id;
      });
      if (focus) tab.focus();
      const qs = container.dataset.tabs;
      if (qs && typeof history.replaceState === 'function') {
        const url = new URL(window.location.href);
        url.searchParams.set(qs, tab.dataset.tab || '');
        history.replaceState(null, '', url.toString());
      }
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => activate(tab, false));
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault(); activate(tabs[(i + 1) % tabs.length]);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault(); activate(tabs[(i - 1 + tabs.length) % tabs.length]);
        }
      });
    });

    const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    activate(initial, false);
  });
})();
