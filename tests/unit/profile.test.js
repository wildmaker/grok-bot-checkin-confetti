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
const T = '已签到。';

function run() {
  const events = [];
  const d = createDetector(profile, (e) => events.push(e));
  return { events, d };
}

test('profile is the narrow, localized, role=status success toast only', () => {
  assert.equal(profile.verified, true);
  assert.equal(SUCCESS_TEXT, T);
  assert.equal(profile.read(page()).state, 'idle');
  assert.deepEqual(profile.read(page(node(T))), { state: 'success', count: 1 });
  assert.equal(profile.read(page(node(`  ${T}\n`))).state, 'success');
  assert.equal(profile.read(page(node(T), node(T))).count, 2);
  for (const text of ['已签到', `${T} 撤销`, '签到', '撤销签到', '已撤销签到。', 'Checked in.', 'Checked in', '', undefined]) {
    assert.equal(profile.read(page(node(text))).state, 'idle', String(text));
  }
  assert.equal(profile.read(page(node(T, 'alert'), node(T, 'log'))).state, 'idle');
});

test('profile is stateless and exposes no page text or identity', () => {
  const p = page(node(T));
  assert.deepEqual(profile.read(p), profile.read(p));
  assert.deepEqual(Object.keys(profile.read(p)).sort(), ['count', 'state']);
});

test('SUPPORTED: one toast = one event; staying, rewrite and re-render do not repeat', () => {
  const { events, d } = run();
  const toast = node(T);
  const p = page(toast);
  for (let i = 0; i < 4; i++) d.evaluate(p);
  toast.textContent = T;
  d.evaluate(p);
  assert.equal(events.length, 1);
});

test('SUPPORTED: React remount of the same visible toast (old removed, new added together) = no duplicate', () => {
  const { events, d } = run();
  const p = page(node(T));
  d.evaluate(p);
  for (let i = 0; i < 3; i++) { p.nodes = [node(T)]; d.evaluate(p); }
  assert.equal(events.length, 1);
});

test('SUPPORTED: same node cleared, then success again = counted again', () => {
  const { events, d } = run();
  const toast = node(T);
  const p = page(toast);
  d.evaluate(p);
  toast.textContent = '';
  d.evaluate(p);
  toast.textContent = T;
  d.evaluate(p);
  assert.equal(events.length, 2);
});

test('SUPPORTED: a second toast visible alongside the first counts; removing the older does not repeat', () => {
  const { events, d } = run();
  const a = node(T);
  const p = page(a);
  d.evaluate(p);
  const b = node(T);
  p.nodes = [a, b];
  d.evaluate(p);
  assert.equal(events.length, 2);
  p.nodes = [b];
  d.evaluate(p);
  assert.equal(events.length, 2);
  p.nodes = [];
  d.evaluate(p);
  p.nodes = [node(T)];
  d.evaluate(p);
  assert.equal(events.length, 3);
});

test('SUPPORTED: two toasts appearing in the same step count twice', () => {
  const { events, d } = run();
  d.evaluate(page(node(T), node(T)));
  assert.equal(events.length, 2);
});

test('SUPPORTED: persistent aria-live clone never counts; transient toast recurrence counts each time', () => {
  const { events, d } = run();
  const clone = { role: undefined, ariaLive: 'polite', textContent: T };
  const p = page(clone, node(T));
  d.evaluate(p);
  assert.equal(events.length, 1);
  p.nodes = [clone];
  d.evaluate(p);
  d.evaluate(p);
  assert.equal(events.length, 1);
  p.nodes = [clone, node(T)];
  d.evaluate(p);
  assert.equal(events.length, 2);
  p.nodes = [clone];
  d.evaluate(p);
  assert.equal(events.length, 2);
});

test('AMBIGUOUS (counted once): a different guest whose identical toast replaces the visible one in a single step', () => {
  const { events, d } = run();
  const p = page(node(T));
  d.evaluate(p);
  p.nodes = [node(T)];
  d.evaluate(p);
  assert.equal(events.length, 1);
});

test('baseline: toast present when the scan route is entered is not celebrated; new ones after it are', () => {
  const { events, d } = run();
  const p = page(node(T));
  d.prime(p);
  d.evaluate(p);
  assert.equal(events.length, 0);
  p.nodes = [node(T), node(T)];
  d.evaluate(p);
  assert.equal(events.length, 1);
  p.nodes = [];
  d.evaluate(p);
  p.nodes = [node(T)];
  d.evaluate(p);
  assert.equal(events.length, 2);
});

test('an empty toast that is filled later fires once, on fill', () => {
  const { events, d } = run();
  const toast = node('');
  const p = page(toast);
  d.evaluate(p);
  assert.equal(events.length, 0);
  toast.textContent = T;
  d.evaluate(p);
  d.evaluate(p);
  assert.equal(events.length, 1);
});
