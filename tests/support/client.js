// tests/support/client.js — a tiny cookie-jar + CSRF HTTP client for the integration tests.
//   const Client = makeClient({ base: () => base, creds: () => creds });   // lazy: the server starts in before()
//   const c = await new Client().login('demo.admin');  await c.get('/en/portal');  await c.post('/en/portal/...', { ... });
import assert from 'node:assert/strict';

export function makeClient({ base, creds }) {
  return class Client {
    constructor() { this.c = {}; }
    absorb(res) { for (const h of res.headers.getSetCookie?.() || []) { const [kv] = h.split(';'); const i = kv.indexOf('='); this.c[kv.slice(0, i)] = kv.slice(i + 1); } }
    get cookie() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join('; '); }
    async req(method, p, form) {
      const headers = { cookie: this.cookie }; let body;
      if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = (form instanceof URLSearchParams ? form : new URLSearchParams(form)).toString(); }
      const res = await fetch(base() + p, { method, headers, body, redirect: 'manual' });
      this.absorb(res);
      return { status: res.status, loc: res.headers.get('location'), text: await res.text() };
    }
    get(p) { return this.req('GET', p); }
    async post(p, form) {
      if (!this.c.sdca_csrf) await this.get('/en/portal/signin');
      const f = form instanceof URLSearchParams ? form : new URLSearchParams(form); f.set('_csrf', this.c.sdca_csrf);
      return this.req('POST', p, f);
    }
    async login(user) { await this.get('/en/portal/signin'); const r = await this.post('/en/portal/signin', { username: user, password: creds()[user] }); assert.equal(r.status, 302, `login ${user}`); return this; }
  };
}
