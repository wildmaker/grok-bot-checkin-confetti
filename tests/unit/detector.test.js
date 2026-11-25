const test = require('node:test');
const assert = require('node:assert/strict');
const { createDetector, hashSignature } = require('../../src/detector.js');

// Tiny fake page: a list of states/signatures the test profile reads back.
function harness(profileOverrides) {
  const page = { state: 'idle', signature: undefined, count: undefined };
  const profile = { id: 't', verified: true, read: () => ({ state: page.state, signature: page.signature, count: page.count }), ...profileOverrides };
  const events = [];
  const d = createDetector(profile, (e) => events.push(e));
  const show = (state, signature, count) => { page.state = state; page.signature = signature; page.count = count; return d.evaluate({}); };
  return { d, events, show, page };
}

test('unverified, missing, or throwing profiles never fire', () => {
  for (const p of [null, undefined, {}, { verified: false, read: () => ({ state: 'success' }) }, { verified: 'true', read: () => ({ state: 'success' }) }]) {
    const events = [];
    createDetector(p, (e) => events.push(e)).evaluate({});
    assert.equal(events.length, 0);
  }
  const events = [];
  const d = createDetector({ verified: true, read() { throw new Error('boom'); } }, (e) => events.push(e));
  assert.doesNotThrow(() => d.evaluate({}));
  assert.equal(events.length, 0);
});

test('single success fires once; repeated reads of the same result do not repeat', () => {
  const h = harness();
  for (let i = 0; i < 5; i++) h.show('success', 'a');
  assert.deepEqual(h.events, [{ type: 'success', seq: 1 }]);
});

test('failure, duplicate, pending, no-match, idle and unrecognised states never fire', () => {
  const h = harness();
  for (const s of ['failure', 'duplicate', 'pending', 'nomatch', 'idle', 'unknown', 'bogus']) h.show(s, 'x');
  assert.equal(h.events.length, 0);
});

test('a later success after a lifecycle reset fires again, even with the same signature', () => {
  const h = harness();
  h.show('success', 'a'); h.show('idle'); h.show('success', 'a');
  assert.equal(h.events.length, 2);
});

test('different signatures back to back both fire (no time window)', () => {
  const h = harness();
  h.show('success', 'a'); h.show('success', 'b');
  assert.deepEqual(h.events.map((e) => e.seq), [1, 2]);
});

test('success -> failure -> success counts the two successes only', () => {
  const h = harness();
  h.show('success', 'a'); h.show('failure', 'a'); h.show('success', 'b');
  assert.equal(h.events.length, 2);
});

test('transient unknown during a rerender does not reset or repeat', () => {
  const h = harness();
  h.show('success', 'a'); h.show('unknown'); h.show('success', 'a');
  assert.equal(h.events.length, 1);
});

test('prime records the baseline without firing', () => {
  const h = harness();
  h.page.state = 'success'; h.page.signature = 'a';
  h.d.prime({});
  h.d.evaluate({});
  assert.equal(h.events.length, 0);
  h.show('success', 'b');
  assert.equal(h.events.length, 1);
});

test('events never expose the signature', () => {
  const h = harness();
  h.show('success', 'private-looking-token');
  assert.equal(JSON.stringify(h.events).includes('private'), false);
  assert.notEqual(hashSignature('a'), hashSignature('b'));
});

test('count: extra simultaneous successes fire once each; decreases and holds do not', () => {
  const h = harness();
  h.show('success', undefined, 1);
  h.show('success', undefined, 2);
  h.show('success', undefined, 2);
  h.show('success', undefined, 1);
  assert.equal(h.events.length, 2);
  h.show('success', undefined, 2);
  assert.equal(h.events.length, 3);
});

test('count: several appearing from idle in one step fire once each, bounded per step', () => {
  const h = harness();
  h.show('success', undefined, 3);
  assert.equal(h.events.length, 3);
  h.show('idle');
  h.show('success', undefined, 50);
  assert.equal(h.events.length, 3 + 5);
});

test('count: replacing a result by an identical one within one step is counted once (documented ambiguity)', () => {
  const h = harness();
  h.show('success', undefined, 1);
  h.show('success', undefined, 1);
  assert.equal(h.events.length, 1);
});

test('count: reset states clear the count baseline', () => {
  const h = harness();
  h.show('success', undefined, 2);
  h.show('failure');
  h.show('success', undefined, 1);
  assert.equal(h.events.length, 3);
});
