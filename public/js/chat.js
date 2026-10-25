// chat.js — floating chat widget. Talks only to POST /api/chat (SSE); knows nothing about sources or models.
const zh = document.documentElement.lang.startsWith('zh');
const T = zh
  ? { title: '學苑小幫手', hello: '您好！我可以回答關於聖地牙哥中華學苑的問題，例如註冊、課程與聯絡方式。', ph: '請輸入問題…', send: '送出', note: 'AI 助理，回答可能有誤，重要事項請洽辦公室。', err: '抱歉，目前無法回答。請稍後再試，或前往', contact: '聯絡我們頁面', src: '相關頁面', hand: '把問題轉給辦公室', hName: '您的姓名', hMail: '您的電郵', hSend: '送出', hOk: '已送出，辦公室會以電郵回覆您。', hBad: '請填寫有效的電郵。', open: '開啟聊天', close: '關閉' }
  : { title: 'SDCA Assistant', hello: 'Hi! I can answer questions about San Diego Chinese Academy: registration, classes, contact info and more.', ph: 'Ask a question…', send: 'Send', note: 'AI assistant — may make mistakes. For anything important, contact the office.', err: 'Sorry, I can’t answer right now. Please try again later or use the ', contact: 'Contact page', src: 'Related pages', hand: 'Send this question to the office', hName: 'Your name', hMail: 'Your e-mail', hSend: 'Send', hOk: 'Sent. The office will reply by e-mail.', hBad: 'Please enter a valid e-mail.', open: 'Open chat', close: 'Close' };

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

function offerHandoff(bot, q) {
  const f = el('form', 'chat-handoff');
  const n = el('input'); n.placeholder = T.hName; n.maxLength = 100; n.setAttribute('aria-label', T.hName);
  const m = el('input'); m.type = 'email'; m.placeholder = T.hMail; m.maxLength = 200; m.required = true; m.setAttribute('aria-label', T.hMail);
  const b = el('button', '', T.hand); b.type = 'submit';
  const msg = el('div', 'chat-note');
  f.append(n, m, b, msg);
  f.onsubmit = async (e) => {
    e.preventDefault(); b.disabled = true;
    try {
      const r = await fetch('/api/chat/handoff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q, name: n.value, email: m.value, lang: zh ? 'zh' : 'en' }) });
      if (!r.ok) throw new Error(String(r.status));
      f.replaceChildren(el('div', 'chat-note', T.hOk));
    } catch { msg.textContent = T.hBad; b.disabled = false; }
  };
  bot.append(f);
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  input.value = ''; btn.disabled = true;
  add('user', q);
  const bot = add('bot', '…');
  let text = '', srcs = [], hand = false;
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
        else if (ev.type === 'handoff') hand = true;
        else if (ev.type === 'error') throw new Error('stream');
      }
    }
    if (!text) throw new Error('empty');
    if (srcs.length) {
      const box = el('div', 'chat-src', `${T.src}:`);
      for (const s of srcs) { const a = el('a', '', s.title); a.href = zh ? s.url.replace(/^\/en\//, '/zh/') : s.url; box.append(a); }
      bot.append(box);
    }
    if (hand) offerHandoff(bot, q);
    history.push({ role: 'user', content: q }, { role: 'assistant', content: text });
  } catch { bot.textContent = T.err; const a = el('a', '', T.contact); a.href = zh ? '/zh/contact' : '/en/contact'; bot.append(a, zh ? '。' : '.'); }
  btn.disabled = false; input.focus();
};
