// tests/i18n.test.js — EN/ZH key parity and basic values
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keys, parity, t, SUPPORTED } from '../src/i18n/index.js';

test('EN and ZH have identical key sets', () => {
  assert.ok(parity(), 'en/zh key sets differ');
});

test('both files are non-empty', () => {
  assert.ok(keys('en').length >= 20, 'en.json should have at least 20 keys');
  assert.ok(keys('zh').length >= 20, 'zh.json should have at least 20 keys');
});

test('t() returns the right-language string', () => {
  assert.match(t('en', 'nav.home'), /^Home$/);
  assert.match(t('zh', 'nav.home'), /^首頁$/);
});

test('SUPPORTED includes en and zh', () => {
  assert.deepEqual(SUPPORTED.slice().sort(), ['en', 'zh']);
});
