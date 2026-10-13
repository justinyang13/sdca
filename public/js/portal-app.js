// portal-app.js — small helpers for the portal pages (CSP: no inline scripts).
document.addEventListener('submit', (e) => {
  const msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
  if (msg && !window.confirm(msg)) e.preventDefault();
}, true);
document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-print]');
  if (p) { e.preventDefault(); window.print(); }
  const a = e.target.closest('a[data-print]');
  if (a) { e.preventDefault(); window.print(); }
});
document.querySelectorAll('select[data-autosubmit]').forEach((s) => s.addEventListener('change', () => s.form.submit()));
if (new URLSearchParams(location.search).get('print') === '1') setTimeout(() => window.print(), 300);

// type-ahead for foreign keys with many rows (people, families…)
document.querySelectorAll('input.ref-input').forEach((inp) => {
  const hidden = document.getElementById(inp.dataset.target);
  const wrap = document.createElement('div'); wrap.className = 'ref-wrap';
  inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
  const list = document.createElement('ul'); list.className = 'ref-list'; list.hidden = true; wrap.appendChild(list);
  let timer = null;
  const close = () => { list.hidden = true; list.textContent = ''; };
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    if (!inp.value.trim()) { hidden.value = ''; close(); return; }
    timer = setTimeout(async () => {
      try {
        const r = await fetch(`${inp.dataset.url}?q=${encodeURIComponent(inp.value.trim())}`, { credentials: 'same-origin' });
        const rows = await r.json();
        list.textContent = '';
        rows.forEach((row) => { const li = document.createElement('li'); li.textContent = row.label; li.addEventListener('mousedown', (ev) => { ev.preventDefault(); inp.value = row.label; hidden.value = row.id; close(); }); list.appendChild(li); });
        list.hidden = !rows.length;
      } catch { close(); }
    }, 180);
  });
  inp.addEventListener('blur', () => setTimeout(close, 150));
});

// the portal menu is always open on wide screens and collapsible on phones
document.querySelectorAll('[data-portal-menu]').forEach((d) => {
  const sync = () => { if (window.matchMedia('(min-width: 961px)').matches) d.open = true; };
  sync(); window.addEventListener('resize', sync);
});

// wide lists: expandable rows + per-browser column picker
document.addEventListener('click', (e) => {
  const t = e.target.closest('.row-toggle');
  if (!t) return;
  const tr = t.closest('tr'); const detail = tr.nextElementSibling;
  if (!detail || !detail.classList.contains('row-detail')) return;
  const open = detail.hidden;
  detail.hidden = !open; t.setAttribute('aria-expanded', String(open)); t.textContent = open ? '▾' : '▸';
});
document.querySelectorAll('[data-col-picker]').forEach((box) => {
  const key = box.dataset.colPicker; const store = `sdca.cols.${key}`;
  const wrap = document.querySelector(`[data-col-table="${key}"]`);
  const boxes = [...box.querySelectorAll('input[type=checkbox]')];
  const defaults = box.dataset.defaults.split(',');
  const apply = (visible) => {
    boxes.forEach((c) => { c.checked = c.disabled || visible.includes(c.value); });
    wrap.querySelectorAll('[data-col]').forEach((el) => el.classList.toggle('col-off', !(el.dataset.col === boxes[0].value || visible.includes(el.dataset.col))));
  };
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(store) || 'null'); } catch { saved = null; }
  apply(Array.isArray(saved) ? saved : defaults);
  const save = (v) => { try { localStorage.setItem(store, JSON.stringify(v)); } catch { /* private mode */ } };
  boxes.forEach((c) => c.addEventListener('change', () => { const v = boxes.filter((x) => x.checked).map((x) => x.value); save(v); apply(v); }));
  box.querySelector('[data-col-reset]').addEventListener('click', () => { try { localStorage.removeItem(store); } catch { /* ignore */ } apply(defaults); });
});

// list toolbar: dropdown filters apply instantly; the search / text filters apply on Enter
document.querySelectorAll('form[data-instant-filters]').forEach((f) => {
  f.querySelectorAll('select').forEach((sel) => sel.addEventListener('change', () => f.submit()));
  f.querySelectorAll('input[type=search], input[type=text]').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); f.submit(); } }));
});
