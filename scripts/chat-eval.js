// scripts/chat-eval.js — score the chatbot against tests/chat-eval/questions.json.
// usage: node scripts/chat-eval.js [--set basic|hard] [--id en-first-day] [--lang zh] [--url http://localhost:3200]
// Without --url it runs the orchestrator in-process (real index + real Ollama model).
// Scoring is keyword-based: a question passes if the answer contains any `expect_any` string
// (case-insensitive) and none of `expect_none` / `expect_none_regex`. Read failures by eye too.
import fs from 'node:fs';
import { openDb } from '../src/db/open.js';
import { createRetriever } from '../src/chat/retriever.js';
import { ollamaProvider } from '../src/chat/provider-ollama.js';
import { answer } from '../src/chat/orchestrator.js';
import { officeContact } from '../src/school.js';

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const questions = JSON.parse(fs.readFileSync(new URL('../tests/chat-eval/questions.json', import.meta.url), 'utf8'))
  .filter((q) => (!arg('set') || q.set === arg('set')) && (!arg('id') || q.id === arg('id')) && (!arg('lang') || q.lang === arg('lang')));
const url = arg('url');
const db = url ? null : openDb();
const retriever = url ? null : createRetriever(db);
const contact = url ? null : officeContact(db);
const provider = url ? null : ollamaProvider();

async function ask(q) {
  let text = ''; let sources = [];
  if (url) {
    const res = await fetch(`${url}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: q.q, lang: q.lang, history: q.history || [] }) });
    for (const block of (await res.text()).split('\n\n')) {
      if (!block.startsWith('data: ')) continue;
      const ev = JSON.parse(block.slice(6));
      if (ev.type === 'delta') text += ev.text; else if (ev.type === 'sources') sources = ev.sources;
    }
  } else {
    for await (const ev of answer({ message: q.q, history: q.history || [], lang: q.lang, retriever, provider, contact })) {
      if (ev.type === 'delta') text += ev.text; else if (ev.type === 'sources') sources = ev.sources;
    }
  }
  return { text: text.trim(), sources };
}

function score(q, text) {
  const low = text.toLowerCase().replace(/\s+/g, '');   // ignore spacing, e.g. "11 月 15 日"
  if (!q.expect_any.some((s) => low.includes(s.toLowerCase().replace(/\s+/g, '')))) return 'missing expected text';
  if ((q.expect_none || []).some((s) => low.includes(s.toLowerCase()))) return 'contains forbidden text';
  if (q.expect_none_regex && new RegExp(q.expect_none_regex).test(text)) return 'invented figure';
  return null;
}

const results = [];
for (const q of questions) {
  const t0 = Date.now();
  let r; let fail;
  try { r = await ask(q); fail = score(q, r.text); } catch (e) { r = { text: '', sources: [] }; fail = `error: ${e.message}`; }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  results.push({ id: q.id, lang: q.lang, kind: q.kind, pass: !fail, fail, secs: Number(secs), answer: r.text, sources: r.sources.map((s) => s.url) });
  console.log(`${fail ? 'FAIL' : 'pass'}  ${q.id.padEnd(16)} ${secs}s${fail ? `  (${fail})\n      Q: ${q.q}\n      A: ${r.text.slice(0, 300).replace(/\n/g, ' ')}` : ''}`);
}

const by = (f) => results.filter(f);
const pct = (a) => `${a.filter((r) => r.pass).length}/${a.length}`;
const setPct = (n) => pct(by((r) => questions.find((x) => x.id === r.id).set === n));
console.log(`\nBASIC ${setPct('basic')}  HARD ${setPct('hard')}`);
console.log(`TOTAL ${pct(results)}  |  EN ${pct(by((r) => r.lang === 'en'))}  ZH ${pct(by((r) => r.lang === 'zh'))}  |  answer ${pct(by((r) => r.kind === 'answer'))}  no_invent ${pct(by((r) => r.kind === 'no_invent'))}  refuse ${pct(by((r) => r.kind === 'refuse'))}`);
fs.mkdirSync(new URL('../work/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../work/chat-eval-last.json', import.meta.url), JSON.stringify(results, null, 1));
process.exit(results.every((r) => r.pass) ? 0 : 1);
