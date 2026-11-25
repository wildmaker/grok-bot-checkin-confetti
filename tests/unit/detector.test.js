const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { createDetector, hashSignature } = require('../../src/detector.js');
const { profile: synthetic } = require('../../test-support/synthetic-profile.js');
const { profile: production } = (() => {
  const g = {};
  new Function('globalThis', require('node:fs').readFileSync(require('node:path').join(__dirname, '../../src/profile.js'), 'utf8'))(g);
  return g.GrokBotCheckin;
})();

// All fixtures here are SYNTHETIC markers; they say nothing about the real Luma DOM.
function page() {
  const dom = new JSDOM('<body><main id="m"></main></body>');
  const doc = dom.window.document;
  const set = (state, token) => {
    doc.getElementById('m').innerHTML = state ? `<div data-synthetic-result data-state="${state}" data-synthetic-token="${token || ''}"></div>` : '';
  };
  return { doc, set };
}

function harness(profile = synthetic) {
  const { doc, set } = page();
  const events = [];
  const d = createDetector(profile, (e) => events.push(e));
  return { doc, set, events, d, eval: () => d.evaluate(doc) };
}

test('production profile is unverified and fail-closed', () => {
  assert.equal(production.verified, false);
  const { doc, events } = harness(production);
  const d = createDetector(production, (e) => events.push(e));
  doc.body.innerHTML = '<div role="alert">1 checked in</div><div data-synthetic-result data-state="success" data-synthetic-token="a"></div>';
  assert.equal(d.enabled, false);
  assert.equal(d.evaluate(doc), false);
  assert.equal(events.length, 0);
});

test('unverified, missing, or throwing profiles never fire', () => {
  for (const p of [null, undefined, {}, { verified: false, read: () => ({ state: 'success' }) }, { verified: 'true', read: () => ({ state: 'success' }) }]) {
    const events = [];
    const d = createDetector(p, (e) => events.push(e));
    d.evaluate({});
    assert.equal(events.length, 0);
  }
  const events = [];
  const d = createDetector({ verified: true, read() { throw new Error('boom'); } }, (e) => events.push(e));
  assert.doesNotThrow(() => d.evaluate({}));
  assert.equal(events.length, 0);
});

test('single success fires once; rerenders of the same result do not repeat', () => {
  const h = harness();
  h.set('success', 'guest-a'); h.eval();
  for (let i = 0; i < 5; i++) { h.set('success', 'guest-a'); h.eval(); }
  assert.equal(h.events.length, 1);
  assert.deepEqual(h.events[0], { type: 'success', seq: 1 });
});

test('failure, duplicate, pending, no-match and idle never fire', () => {
  const h = harness();
  for (const s of ['failure', 'duplicate', 'pending', 'nomatch', null, 'bogus']) { h.set(s, 'x'); h.eval(); }
  assert.equal(h.events.length, 0);
});

test('ambiguous mixed states fail closed', () => {
  const h = harness();
  h.doc.getElementById('m').innerHTML =
    '<div data-synthetic-result data-state="success" data-synthetic-token="a"></div><div data-synthetic-result data-state="failure" data-synthetic-token="a"></div>';
  h.eval();
  assert.equal(h.events.length, 0);
});

test('a later success after a lifecycle reset fires again, even for the same token', () => {
  const h = harness();
  h.set('success', 'a'); h.eval();
  h.set(null); h.eval();
  h.set('success', 'a'); h.eval();
  assert.equal(h.events.length, 2);
});

test('two different guests in immediate succession are both celebrated (no time-based collapse)', () => {
  const h = harness();
  h.set('success', 'guest-a'); h.eval();
  h.set('success', 'guest-b'); h.eval();
  assert.equal(h.events.length, 2);
  assert.deepEqual(h.events.map((e) => e.seq), [1, 2]);
});

test('success -> failure -> success counts both successes; failure never counts', () => {
  const h = harness();
  h.set('success', 'a'); h.eval();
  h.set('failure', 'a'); h.eval();
  h.set('success', 'b'); h.eval();
  assert.equal(h.events.length, 2);
});

test('duplicate result after success does not fire and resets the lifecycle', () => {
  const h = harness();
  h.set('success', 'a'); h.eval();
  h.set('duplicate', 'a'); h.eval();
  assert.equal(h.events.length, 1);
  h.set('success', 'c'); h.eval();
  assert.equal(h.events.length, 2);
});

test('transient unknown during a rerender does not cause a repeat', () => {
  const h = harness();
  h.set('success', 'a'); h.eval();
  h.doc.getElementById('m').innerHTML = '<div data-synthetic-result data-state="???"></div>';
  h.eval();
  h.set('success', 'a'); h.eval();
  assert.equal(h.events.length, 1);
});

test('prime records baseline without firing; pre-existing success is not celebrated', () => {
  const h = harness();
  h.set('success', 'a');
  h.d.prime(h.doc);
  h.eval();
  assert.equal(h.events.length, 0);
  h.set('success', 'b'); h.eval();
  assert.equal(h.events.length, 1);
});

test('events never expose the signature', () => {
  const h = harness();
  h.set('success', 'private-looking-token'); h.eval();
  assert.equal(JSON.stringify(h.events).includes('private'), false);
  assert.notEqual(hashSignature('a'), hashSignature('b'));
});
