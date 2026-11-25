/*
 * Detection profile for Luma's native check-in success toast (Simplified Chinese UI).
 *
 * Evidence (read-only, user-authorized single check-in on the attendee-detail view of the
 * /guests route): when the native "check in" button succeeded, Luma briefly rendered
 * <element role="status"> with the exact text "已签到。" and also left an
 * aria-live="polite" element with the same text. Nothing else is consumed.
 *
 * NOT verified: that the same toast appears for a QR scan on /scan (no camera was available),
 * and what failure/duplicate/invalid UI looks like. Those states are simply never matched.
 *
 * Rules:
 *  - Only an element with role="status" whose trimmed text is exactly SUCCESS_TEXT counts.
 *  - The aria-live clone, counters, row/button labels and any other text are ignored, so the
 *    clone cannot double-count a toast.
 *  - Each distinct role="status" node is one check-in. Re-renders that keep the node (or rewrite
 *    its text) do not repeat; a new toast node for a different guest counts, even while an older
 *    toast is still visible. The signature is only an in-memory node counter, never page data.
 *  - Toasts already on screen when the scan route is entered are the baseline (see detector.prime).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUCCESS_TEXT = '已签到。';
  const nodeIds = new WeakMap();
  let lastId = 0;

  const profile = {
    id: 'luma-native-success-toast-zh-v1',
    verified: true,
    read(root) {
      let newest = 0;
      for (const el of root.querySelectorAll('[role="status"]')) {
        if ((el.textContent || '').trim() !== SUCCESS_TEXT) continue;
        if (!nodeIds.has(el)) nodeIds.set(el, ++lastId);
        newest = Math.max(newest, nodeIds.get(el));
      }
      return newest ? { state: 'success', signature: `toast-${newest}` } : { state: 'idle' };
    },
  };

  return { profile, SUCCESS_TEXT };
});
