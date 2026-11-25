const test = require('node:test');
const assert = require('node:assert/strict');
const { createCelebrationQueue } = require('../../src/queue.js');

test('runs one celebration at a time and keeps order', () => {
  const dones = [];
  const started = [];
  const q = createCelebrationQueue((i, done) => { started.push(i); dones.push(done); }, 3);
  q.enqueue(); q.enqueue(); q.enqueue();
  assert.deepEqual(started, [0]);
  dones[0](); assert.deepEqual(started, [0, 1]);
  dones[1](); assert.deepEqual(started, [0, 1, 2]);
  dones[2](); assert.equal(q.stats().running, false);
});

test('caps pending work and counts drops', () => {
  const q = createCelebrationQueue(() => {}, 2);
  const results = [q.enqueue(), q.enqueue(), q.enqueue(), q.enqueue(), q.enqueue()];
  assert.deepEqual(results, [true, true, true, false, false]); // 1 running + 2 pending
  assert.equal(q.stats().dropped, 2);
});

test('done is idempotent and destroy stops further work', () => {
  const started = [];
  let first;
  const q = createCelebrationQueue((i, done) => { started.push(i); first = first || done; }, 5);
  q.enqueue(); q.enqueue();
  first(); first();
  assert.deepEqual(started, [0, 1]);
  q.destroy();
  assert.equal(q.enqueue(), false);
});

test('synchronous done does not overflow or lose items', () => {
  let n = 0;
  const q = createCelebrationQueue((i, done) => { n += 1; done(); }, 6);
  for (let i = 0; i < 6; i++) q.enqueue();
  assert.equal(n, 6);
});
