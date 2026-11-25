const test = require('node:test');
const assert = require('node:assert/strict');
const { profile, SUCCESS_TEXT } = require('../../src/profile.js');
const { createDetector } = require('../../src/detector.js');

// Fake DOM: only what the profile reads (querySelectorAll('[role="status"]') and textContent).
const node = (text, role = 'status') => ({ role, textContent: text });
const page = (...nodes) => ({
  nodes,
  querySelectorAll(sel) {
    assert.equal(sel, '[role="status"]', 'profile must only query role=status');
    return this.nodes.filter((n) => n.role === 'status');
  },
});

function run() {
  const events = [];
  const d = createDetector(profile, (e) => events.push(e));
  return { events, d };
}

test('profile is the narrow, localized, role=status success toast only', () => {
  assert.equal(profile.verified, true);
  assert.equal(SUCCESS_TEXT, '已签到。');
  assert.equal(profile.read(page()).state, 'idle');
  assert.equal(profile.read(page(node('已签到。'))).state, 'success');
  assert.equal(profile.read(page(node('  已签到。\n'))).state, 'success');
  for (const text of ['已签到', '已签到。 撤销', '签到', '撤销签到', '已撤销签到。', 'Checked in.', 'Checked in', '', undefined]) {
    assert.equal(profile.read(page(node(text))).state, 'idle', String(text));
  }
  assert.equal(profile.read(page(node('已签到。', 'alert'), node('已签到。', 'log'))).state, 'idle');
});

test('profile exposes no page text in its signature', () => {
  const sig = profile.read(page(node('已签到。'))).signature;
  assert.match(sig, /^toast-\d+$/);
});

test('one toast node = one event; same node staying or being rewritten does not repeat', () => {
  const { events, d } = run();
  const toast = node('已签到。');
  const p = page(toast);
  for (let i = 0; i < 4; i++) d.evaluate(p);
  toast.textContent = '已签到。';
  d.evaluate(p);
  assert.equal(events.length, 1);
});

test('a toast present at prime time is baseline; a new toast afterwards counts', () => {
  const { events, d } = run();
  const old = node('已签到。');
  const p = page(old);
  d.prime(p);
  d.evaluate(p);
  assert.equal(events.length, 0);
  p.nodes = [];
  d.evaluate(p);
  p.nodes = [node('已签到。')];
  d.evaluate(p);
  assert.equal(events.length, 1);
});

test('a second guest toast appearing while the first is still visible counts; removing the first does not', () => {
  const { events, d } = run();
  const a = node('已签到。');
  const p = page(a);
  d.evaluate(p);
  const b = node('已签到。');
  p.nodes = [a, b];
  d.evaluate(p);
  assert.equal(events.length, 2);
  p.nodes = [b];
  d.evaluate(p);
  assert.equal(events.length, 2);
  p.nodes = [];
  d.evaluate(p);
  p.nodes = [node('已签到。')];
  d.evaluate(p);
  assert.equal(events.length, 3);
});

test('the aria-live clone (no role) and other statuses are never a trigger', () => {
  const { events, d } = run();
  const p = page(node('已签到。', 'status'));
  d.evaluate(p);
  p.nodes = [];
  d.evaluate(p);
  p.nodes = [{ role: undefined, ariaLive: 'polite', textContent: '已签到。' }, node('已签到'), node('Checked in.')];
  d.evaluate(p);
  assert.equal(events.length, 1);
});

test('an empty toast that is filled later fires once, on fill', () => {
  const { events, d } = run();
  const toast = node('');
  const p = page(toast);
  d.evaluate(p);
  assert.equal(events.length, 0);
  toast.textContent = '已签到。';
  d.evaluate(p);
  d.evaluate(p);
  assert.equal(events.length, 1);
});
