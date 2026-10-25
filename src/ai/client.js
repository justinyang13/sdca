// src/ai/client.js — one non-streaming call to the language model, for the AI helpers (translate, query expansion, report questions).
// The chat widget streams through src/chat/provider-ollama.js; this is the small "ask once, get text or JSON back" path.
// Tests replace the model with setAiClient(); when the model is unreachable every helper degrades to its non-AI behaviour.
const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = () => process.env.AI_MODEL || process.env.CHAT_MODEL || 'qwen3.8:27b';

async function ollamaGenerate(messages, { json = false, timeoutMs = 60000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${HOST}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ model: MODEL(), messages, stream: false, think: false, keep_alive: '30m', ...(json ? { format: 'json' } : {}), options: { temperature: 0.1, num_ctx: 8192 } }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    return String((await res.json()).message?.content ?? '').trim();
  } finally { clearTimeout(timer); }
}

let impl = ollamaGenerate;
/** Replace the model call (tests): fn(messages, opts) -> Promise<string>. Call with no argument to restore Ollama. */
export const setAiClient = (fn) => { impl = fn || ollamaGenerate; };

/** @returns {Promise<string>} the model's reply; rejects when the model is unreachable */
export const generate = (messages, opts) => impl(messages, opts);

/** Ask for a JSON object. Returns the parsed object, or null when the reply is not valid JSON or the model is down. */
export async function generateJson(messages, opts = {}) {
  try {
    const t = await impl(messages, { ...opts, json: true });
    const m = t.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}
