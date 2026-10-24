// chat.js — floating chat widget. Talks only to POST /api/chat (SSE); knows nothing about sources or models.
const zh = document.documentElement.lang.startsWith('zh');
const T = zh
  ? { title: '學苑小幫手', hello: '您好！我可以回答關於聖地牙哥中華學苑的問題，例如註冊、課程與聯絡方式。', ph: '請輸入問題…', send: '送出', note: 'AI 助理，回答可能有誤，重要事項請洽辦公室。', err: '抱歉，目前無法回答。請聯絡辦公室：Office.SDCA@gmail.com', src: '相關頁面', open: '開啟聊天', close: '關閉' }
  : { title: 'SDCA Assistant', hello: 'Hi! I can answer questions about San Diego Chinese Academy: registration, classes, contact info and more.', ph: 'Ask a question…', send: 'Send', note: 'AI assistant — may make mistakes. For anything important, contact the office.', err: 'Sorry, I can’t answer right now. Please contact the office: Office.SDCA@gmail.com', src: 'Related pages', open: 'Open chat', close: 'Close' };

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const fab = el('button', 'chat-fab', '💬'); fab.type = 'button'; fab.setAttribute('aria-label', T.open);
const panel = el('section', 'chat-panel'); panel.setAttribute('aria-label', T.title);
const head = el('div', 'chat-head'); head.append(el('span', '', T.title));
const x = el('button', '', '×'); x.type = 'button'; x.setAttribute('aria-label', T.close); head.append(x);
const log = el('div', 'chat-log'); log.setAttribute('aria-live', 'polite');
const note = el('div', 'chat-note', T.note);
const form = el('form', 'chat-form');
const input = el('input'); input.type = 'text'; input.maxLength = 500; input.placeholder = T.ph; input.setAttribute('aria-label', T.ph); input.autocomplete = 'off';
const btn = el('button', '', T.send); btn.type = 'submit';
form.append(input, btn);
panel.append(head, log, note, form);
document.body.append(fab, panel);

const history = [];
const add = (role, text) => { const m = el('div', `chat-msg ${role}`, text); log.append(m); log.scrollTop = log.scrollHeight; return m; };
add('bot', T.hello);

function toggle(open) { panel.classList.toggle('open', open); if (open) input.focus(); }
fab.onclick = () => toggle(!panel.classList.contains('open'));
x.onclick = () => { toggle(false); fab.focus(); };
panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { toggle(false); fab.focus(); } });

form.onsubmit = async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  input.value = ''; btn.disabled = true;
  add('user', q);
  const bot = add('bot', '…');
  let text = '', srcs = [];
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: q, history, lang: zh ? 'zh' : 'en' }) });
    if (!res.ok || !res.body) throw new Error(String(res.status));
    const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).replace(/^data: /, ''); buf = buf.slice(i + 2);
        const ev = JSON.parse(line);
        if (ev.type === 'sources') srcs = ev.sources;
        else if (ev.type === 'delta') { text += ev.text; bot.textContent = text; log.scrollTop = log.scrollHeight; }
        else if (ev.type === 'error') throw new Error('stream');
      }
    }
    if (!text) throw new Error('empty');
    if (srcs.length) {
      const box = el('div', 'chat-src', `${T.src}:`);
      for (const s of srcs) { const a = el('a', '', s.title); a.href = zh ? s.url.replace(/^\/en\//, '/zh/') : s.url; box.append(a); }
      bot.append(box);
    }
    history.push({ role: 'user', content: q }, { role: 'assistant', content: text });
  } catch { bot.textContent = T.err; }
  btn.disabled = false; input.focus();
};
