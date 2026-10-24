// src/chat/provider-ollama.js — model adapter. Interface: stream(messages, opts) -> async generator of text deltas.
// Swap this file (or add provider-anthropic.js with the same shape) to change the model.
const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

export function ollamaProvider({ model = process.env.CHAT_MODEL || 'qwen3.8:27b', temperature = 0.2, timeoutMs = 120000 } = {}) {
  return {
    name: `ollama:${model}`,
    async *stream(messages, { signal } = {}) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      signal?.addEventListener('abort', () => ctl.abort());
      try {
        const res = await fetch(`${HOST}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model, messages, stream: true, think: false, keep_alive: '30m', options: { temperature, num_ctx: 8192 } }),
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`ollama ${res.status}`);
        const dec = new TextDecoder();
        let buf = '';
        for await (const part of res.body) {
          buf += dec.decode(part, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const j = JSON.parse(line);
            if (j.message?.content) yield j.message.content;
            if (j.done) return;
          }
        }
      } finally { clearTimeout(timer); }
    },
  };
}
