// nav.js — mobile drawer + dropdown navigation, keyboard support
(() => {
  const site = document.getElementById('site');
  if (!site) return;

  const toggle = site.querySelector('[data-nav-toggle]');
  const drawer = site.querySelector('.mobile-drawer');
  const overlay = site.querySelector('.drawer-overlay');
  const drawerClose = drawer ? drawer.querySelector('.drawer-close') : null;

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open');
    overlay && overlay.classList.add('visible');
    overlay && (overlay.style.display = 'block');
    document.body.style.overflow = 'hidden';
    const first = drawer.querySelector('a, button');
    first && first.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    overlay && overlay.classList.remove('visible');
    overlay && (overlay.style.display = '');
    document.body.style.overflow = '';
    toggle && toggle.focus();
  }

  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      const open = drawer.classList.contains('open');
      open ? closeDrawer() : openDrawer();
      toggle.setAttribute('aria-expanded', String(!open));
    });
    overlay && overlay.addEventListener('click', closeDrawer);
    drawerClose && drawerClose.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
    });
  }

  // Sub-menu expand/collapse inside drawer
  if (drawer) {
    drawer.querySelectorAll('.nav-trigger').forEach((btn) => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        const sub = drawer.querySelector(btn.getAttribute('aria-controls'));
        if (sub) sub.hidden = expanded;
      });
    });
  }

  // ---- Desktop dropdowns ----
  const desktopNav = site.querySelector('.site-nav');
  if (desktopNav) {
    const triggers = desktopNav.querySelectorAll('.nav-trigger');
    let openMenu = null;

    function closeAll() {
      triggers.forEach((t) => {
        t.setAttribute('aria-expanded', 'false');
        const menu = desktopNav.querySelector(t.getAttribute('aria-controls'));
        if (menu) menu.classList.remove('open');
      });
      openMenu = null;
    }
    function openOne(trigger) {
      closeAll();
      trigger.setAttribute('aria-expanded', 'true');
      const menu = desktopNav.querySelector(trigger.getAttribute('aria-controls'));
      if (menu) menu.classList.add('open');
      openMenu = trigger;
    }

    triggers.forEach((trigger) => {
      const menu = desktopNav.querySelector(trigger.getAttribute('aria-controls'));
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        if (isOpen) closeAll();
        else openOne(trigger);
      });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          openOne(trigger);
          const first = menu && menu.querySelector('a');
          first && first.focus();
        } else if (e.key === 'Escape') {
          closeAll();
          trigger.focus();
        }
      });
      if (menu) {
        const links = menu.querySelectorAll('a');
        links.forEach((link, i) => {
          link.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              (links[(i + 1) % links.length] || links[0]).focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              (links[(i - 1 + links.length) % links.length] || links[links.length - 1]).focus();
            } else if (e.key === 'Escape') {
              closeAll();
              trigger.focus();
            }
          });
        });
        menu.addEventListener('mouseenter', () => {
          if (openMenu && openMenu !== trigger) openOne(trigger);
        });
      }
    });

    document.addEventListener('click', (e) => {
      if (openMenu && !desktopNav.contains(e.target)) closeAll();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openMenu) { closeAll(); openMenu.focus(); }
    });
  }
})();
