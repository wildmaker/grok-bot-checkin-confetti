/*
 * Success detector contract.
 *
 * A "profile" adapts a page's DOM to this contract:
 *   { id, verified, read(root) -> { state, count?, signature? } }
 * state is one of: idle | success | failure | duplicate | pending | nomatch | unknown.
 * count (default 1) is how many success results are visible at the same time.
 * signature is an optional in-memory-only string identifying the displayed result; it is
 * hashed, never stored, never logged and never leaves this module.
 *
 * A success event fires when (a) success appears after a non-success state, (b) more success
 * results are visible simultaneously than at the previous evaluation (one event per extra),
 * or (c) the signature changes while success stays visible. State kept: three scalars.
 * Anything not distinguishable by (a)-(c), e.g. a result replaced by an identical one within a
 * single evaluation, is deliberately counted once (no-duplicate policy).
 *
 * The detector is fail-closed: a profile that is not explicitly verified, throws, or
 * returns an unrecognised state can never produce a success event.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RESET_STATES = new Set(['idle', 'failure', 'duplicate', 'pending', 'nomatch']);

  function hashSignature(text) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function readSafely(profile, root) {
    try {
      const result = profile.read(root);
      if (!result || typeof result.state !== 'string') return { state: 'unknown' };
      return result;
    } catch {
      return { state: 'unknown' };
    }
  }

  function createDetector(profile, onSuccess) {
    const enabled = !!profile && profile.verified === true && typeof profile.read === 'function';
    const MAX_EVENTS_PER_STEP = 5;
    let active = false;
    let lastHash = null;
    let lastCount = 0;
    let seq = 0;

    function step(root, fire) {
      if (!enabled) return false;
      const { state, signature, count } = readSafely(profile, root);
      if (state !== 'success') {
        if (RESET_STATES.has(state)) {
          active = false;
          lastHash = null;
          lastCount = 0;
        }
        return false;
      }
      const n = Number.isInteger(count) && count > 0 ? count : 1;
      const hash = typeof signature === 'string' && signature ? hashSignature(signature) : null;
      let events = active ? Math.max(0, n - lastCount) : n;
      if (events === 0 && hash && lastHash && hash !== lastHash) events = 1;
      active = true;
      lastCount = n;
      if (hash) lastHash = hash;
      if (!fire) return false;
      events = Math.min(events, MAX_EVENTS_PER_STEP);
      for (let i = 0; i < events; i++) {
        seq += 1;
        onSuccess({ type: 'success', seq });
      }
      return events > 0;
    }

    return {
      enabled,
      profileId: profile ? profile.id : null,
      /** Records the current state as the baseline without emitting an event. */
      prime: (root) => step(root, false),
      /** Evaluates the page and emits at most one success event per new success. */
      evaluate: (root) => step(root, true),
    };
  }

  return { createDetector, hashSignature };
});
