/*
 * Success detector contract.
 *
 * A "profile" adapts a page's DOM to this contract:
 *   { id, verified, read(root) -> { state, signature? } }
 * state is one of: idle | success | failure | duplicate | pending | nomatch | unknown.
 * signature is an optional in-memory-only string identifying the displayed result; it is
 * hashed, never stored, never logged and never leaves this module.
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
    let active = false;
    let lastHash = null;
    let seq = 0;

    function step(root, fire) {
      if (!enabled) return false;
      const { state, signature } = readSafely(profile, root);
      if (state !== 'success') {
        if (RESET_STATES.has(state)) {
          active = false;
          lastHash = null;
        }
        return false;
      }
      const hash = typeof signature === 'string' && signature ? hashSignature(signature) : null;
      let isNewSuccess = false;
      if (!active) isNewSuccess = true;
      else if (hash && lastHash && hash !== lastHash) isNewSuccess = true;
      active = true;
      if (hash) lastHash = hash;
      if (isNewSuccess && fire) {
        seq += 1;
        onSuccess({ type: 'success', seq });
        return true;
      }
      return false;
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
