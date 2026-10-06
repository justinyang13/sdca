// mini-calendar.js — small month view; days with events (from data-events) are marked.
document.querySelectorAll('[data-mini-cal]').forEach((root) => {
  const zh = root.dataset.lang === 'zh';
  let events = [];
  try { events = JSON.parse(root.dataset.events || '[]'); } catch (e) { events = []; }
  const byDate = new Map();
  events.forEach((e) => { if (!byDate.has(e.date)) byDate.set(e.date, []); byDate.get(e.date).push(e.title); });
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const monthsWithEvents = [...new Set(events.map((e) => e.date.slice(0, 7)))].sort();
  const curKey = todayKey.slice(0, 7);
  let [y, m] = (monthsWithEvents.includes(curKey) ? curKey : (monthsWithEvents.find((k) => k >= curKey) || monthsWithEvents[0] || curKey)).split('-').map(Number);
  const MONTHS = zh ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = zh ? ['日', '一', '二', '三', '四', '五', '六'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  function render() {
    root.textContent = '';
    const head = el('div', 'mc-head');
    const prev = el('button', 'mc-nav', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', zh ? '上個月' : 'Previous month');
    const next = el('button', 'mc-nav', '›'); next.type = 'button'; next.setAttribute('aria-label', zh ? '下個月' : 'Next month');
    head.append(prev, el('div', 'mc-title', zh ? `${y} 年 ${MONTHS[m - 1]}` : `${MONTHS[m - 1]} ${y}`), next);
    const grid = el('div', 'mc-grid'); grid.setAttribute('role', 'grid');
    DOW.forEach((d) => grid.append(el('div', 'mc-dow', d)));
    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el('div', 'mc-day mc-empty'));
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${pad(m)}-${pad(d)}`;
      const evs = byDate.get(key);
      const c = el('div', 'mc-day' + (evs ? ' mc-has' : '') + (key === todayKey ? ' mc-today' : ''), String(d));
      if (evs) { c.tabIndex = 0; c.dataset.key = key; c.setAttribute('aria-label', `${key}: ${evs.join('; ')}`); }
      grid.append(c);
    }
    const pop = el('div', 'mc-pop'); pop.setAttribute('role', 'tooltip'); pop.hidden = true;
    root.append(head, grid, pop);
    const show = (cell) => {
      const evs = byDate.get(cell.dataset.key) || [];
      pop.textContent = '';
      const [py, pm, pd] = cell.dataset.key.split('-').map(Number);
      pop.append(el('div', 'mc-pop-date', zh ? `${pm}月${pd}日` : `${MONTHS[pm - 1]} ${pd}, ${py}`));
      evs.forEach((t) => pop.append(el('div', 'mc-pop-ev', t)));
      pop.hidden = false;
      const r = root.getBoundingClientRect(), c = cell.getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      let left = c.left - r.left + c.width / 2 - w / 2;
      left = Math.max(-(w - 120), Math.min(left, r.width - w + 40));
      let top = c.top - r.top - h - 8;
      if (top < -h) top = c.bottom - r.top + 8;
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    };
    grid.querySelectorAll('.mc-has').forEach((cell) => {
      cell.addEventListener('mouseenter', () => show(cell));
      cell.addEventListener('focus', () => show(cell));
      cell.addEventListener('click', () => show(cell));
      cell.addEventListener('mouseleave', () => { pop.hidden = true; });
      cell.addEventListener('blur', () => { pop.hidden = true; });
    });
    prev.addEventListener('click', () => { m--; if (m < 1) { m = 12; y--; } render(); });
    next.addEventListener('click', () => { m++; if (m > 12) { m = 1; y++; } render(); });
  }
  render();
});
