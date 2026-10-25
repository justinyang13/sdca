// src/chat/routes.js — POST /api/chat (server-sent events). The only HTTP surface of the chat service.
import { createLimiter } from '../middleware/index.js';
import { todayLocal } from '../datetime.js';
import { officeContact } from '../school.js';
import { dailyLimitMessage } from './messages.js';
import { answer } from './orchestrator.js';
import { createRetriever } from './retriever.js';
import { queueEmail } from '../portal/auth.js';
import { ollamaProvider } from './provider-ollama.js';

// Overall cap on model calls per day (all visitors together), so a flood from many IPs cannot run up a hosted-model bill or swamp the model.
const dailyCap = () => Number(process.env.CHAT_DAILY_CAP ?? 2000);
let day = ''; let today = 0;
const overCap = () => { const d = todayLocal(); if (d !== day) { day = d; today = 0; } return ++today > dailyCap(); };

const limiter = createLimiter({ windowMs: 10 * 60 * 1000, max: Number(process.env.CHAT_RATE_LIMIT || 30), message: { error: 'Too many messages. Please try again in a few minutes.' } });

export function registerChatRoutes(app, { db, provider = ollamaProvider(), retriever = createRetriever(db) } = {}) {
  app.locals.chatRetriever = retriever;

  // malformed JSON bodies get a plain 400, not the site's 500 page
  app.use('/api/chat', (err, req, res, next) => (err && err.status === 400 ? res.status(400).json({ error: 'invalid request' }) : next(err)));

  app.post('/api/chat', limiter, async (req, res) => {
    const origin = req.get('origin');
    if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'forbidden' });
    const { message, history, lang } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'message required' });
    const hist = Array.isArray(history) ? history.filter((m) => m && typeof m.content === 'string').slice(-6) : [];

    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const ctl = new AbortController();
    res.on('close', () => ctl.abort());
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    if (overCap()) {
      send({ type: 'delta', text: dailyLimitMessage(lang === 'zh' ? 'zh' : 'en', officeContact(db)) });
      send({ type: 'done' });
      return res.end();
    }
    try {
      for await (const ev of answer({ message, history: hist, lang: lang === 'zh' ? 'zh' : 'en', retriever, provider, contact: officeContact(db), signal: ctl.signal })) {
        if (ev.type === 'unanswered') {      // log what the bot could not answer; the widget then offers "send to the office"
          db.prepare("INSERT INTO chat_inbox (kind, question, lang) VALUES ('unanswered', ?, ?)").run(ev.question, lang === 'zh' ? 'zh' : 'en');
          send({ type: 'handoff' });
        } else send(ev);
      }
    } catch (e) {
      if (!ctl.signal.aborted) { console.error('[chat]', e.message); send({ type: 'error' }); }
    }
    res.end();
  });

  // "Send this question to the office": stored for staff (portal → Chat inbox) and e-mailed to the office address.
  const handoffLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: Number(process.env.CHAT_HANDOFF_LIMIT || 5), message: { error: 'Too many requests. Please use the Contact page.' } });
  app.post('/api/chat/handoff', handoffLimiter, (req, res) => {
    const origin = req.get('origin');
    if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'forbidden' });
    const b = req.body || {};
    const question = String(b.question ?? '').trim().slice(0, 1000);
    const name = String(b.name ?? '').trim().slice(0, 100);
    const email = String(b.email ?? '').trim().slice(0, 200);
    if (!question || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return res.status(400).json({ error: 'question and a valid e-mail are required' });
    const lng = b.lang === 'zh' ? 'zh' : 'en';
    const id = Number(db.prepare("INSERT INTO chat_inbox (kind, question, lang, name, email) VALUES ('handoff', ?, ?, ?, ?)").run(question, lng, name, email).lastInsertRowid);
    queueEmail(db, { to: officeContact(db).email, template: 'chat_handoff', subject: 'Website question from ' + (name || email), body: `${question}\n\nFrom: ${name} <${email}>\nLanguage: ${lng}`, relatedType: 'chat_inbox', relatedId: id });
    res.json({ ok: true });
  });
}
