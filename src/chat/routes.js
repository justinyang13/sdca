// src/chat/routes.js — POST /api/chat (server-sent events). The only HTTP surface of the chat service.
import { createLimiter } from '../middleware/index.js';
import { todayLocal } from '../datetime.js';
import { answer } from './orchestrator.js';
import { createRetriever } from './retriever.js';
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
      send({ type: 'delta', text: lang === 'zh' ? '抱歉，小幫手今天的使用量已滿。請聯絡學校辦公室：Office.SDCA@gmail.com 或 (858) 205-7322。' : 'Sorry, the assistant has reached its limit for today. Please contact the school office: Office.SDCA@gmail.com or (858) 205-7322.' });
      send({ type: 'done' });
      return res.end();
    }
    try {
      for await (const ev of answer({ message, history: hist, lang: lang === 'zh' ? 'zh' : 'en', retriever, provider, signal: ctl.signal })) send(ev);
    } catch (e) {
      if (!ctl.signal.aborted) { console.error('[chat]', e.message); send({ type: 'error' }); }
    }
    res.end();
  });
}
