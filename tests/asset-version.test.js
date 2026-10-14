// tests/asset-version.test.js — content-hash cache busting + the shared portal helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('asset(): adds a short content hash, changes when the file changes, leaves unknown / unsafe paths alone', async () => {
  const { config } = await import('../src/config.js');
  const { asset } = await import('../src/asset-version.js');
  const dir = fs.mkdtempSync(path.join(config.publicDir, '.asset-test-'));
  const rel = `/${path.basename(dir)}/t.css`;
  try {
    fs.writeFileSync(path.join(dir, 't.css'), 'a{color:red}');
    const one = asset(rel);
    assert.match(one, new RegExp(`^${rel.replace(/[.\\/]/g, '\\$&')}\\?v=[0-9a-f]{8}$`));
    assert.equal(asset(rel), one, 'stable while the file is unchanged');
    fs.writeFileSync(path.join(dir, 't.css'), 'a{color:blue}');
    assert.notEqual(asset(rel), one, 'a new hash after an edit');
    assert.equal(asset(`${rel}?v=old`), asset(rel), 'an old ?v= is replaced, not stacked');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.equal(asset('/css/does-not-exist.css'), '/css/does-not-exist.css');
  assert.equal(asset('/../etc/passwd'), '/../etc/passwd', 'path traversal is never read');
  assert.equal(asset('https://example.com/x.js'), 'https://example.com/x.js');
  assert.match(asset('/css/tokens.css'), /^\/css\/tokens\.css\?v=[0-9a-f]{8}$/);
});

test('portal util: s(), dollars(), num(), today() and the redirect / forbidden helpers', async () => {
  const { s, dollars, num, today, portalHelpers } = await import('../src/portal/util.js');
  assert.equal(s('  x '), 'x'); assert.equal(s(null), ''); assert.equal(s(undefined), ''); assert.equal(s(12), '12');
  for (const [input, cents] of [['10', 1000], ['$1,130.50', 113050], ['0.07', 7], ['  2.5 ', 250], ['-5.00', -500], ['', null], ['abc', null], [null, null]]) assert.equal(dollars(input), cents, `dollars(${JSON.stringify(input)})`);
  assert.equal(num(''), null); assert.equal(num(' 4 '), 4); assert.equal(num('x'), NaN);
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
  const calls = [];
  const h = portalHelpers((req, res, view, locals, opts) => calls.push({ view, status: opts.status }));
  const req = { params: { lang: 'zh' }, session: {} }; const res = { redirect: (u) => calls.push({ redirect: u }) };
  assert.equal(h.lang(req), 'zh'); assert.equal(h.P(req), '/zh/portal'); assert.equal(h.P(req, '/x'), '/zh/portal/x');
  h.go(req, res, '/families/1', { type: 'ok', msg: 'saved' });
  assert.deepEqual(calls[0], { redirect: '/zh/portal/families/1' }); assert.deepEqual(req.session.portalFlash, { type: 'ok', msg: 'saved' });
  h.forbidden(req, res); assert.deepEqual(calls[1], { view: 'forbidden.ejs', status: 403 });
  assert.equal(h.staffCan({ portal: { access: { perms: new Map([['a.b', 'all'], ['c.d', 'own_family']]) } } }, 'a.b'), true);
  assert.equal(h.staffCan({ portal: { access: { perms: new Map([['c.d', 'own_family']]) } } }, 'c.d'), false, 'own-scope is not staff-wide');
});
