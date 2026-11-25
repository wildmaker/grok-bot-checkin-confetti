/*
 * SYNTHETIC TEST PROFILE. Not Luma evidence and never shipped in the production package.
 *
 * It reads markers that only the synthetic fixture pages in tests/ render:
 *   <div data-synthetic-result data-state="success|failure|..." data-synthetic-token="...">
 * The build script copies this file over src/profile.js for the test-only extension build.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STATES = new Set(['success', 'failure', 'duplicate', 'pending', 'nomatch']);

  const profile = {
    id: 'synthetic-fixture-v1',
    verified: true,
    read(root) {
      const nodes = Array.from(root.querySelectorAll('[data-synthetic-result]'));
      if (nodes.length === 0) return { state: 'idle' };
      const states = new Set(nodes.map((n) => n.getAttribute('data-state')));
      if (states.size !== 1) return { state: 'unknown' };
      const state = nodes[0].getAttribute('data-state');
      if (!STATES.has(state)) return { state: 'unknown' };
      return { state, signature: nodes[0].getAttribute('data-synthetic-token') || '' };
    },
  };

  return { profile };
});
