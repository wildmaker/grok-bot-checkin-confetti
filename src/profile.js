/*
 * Detection profile for Luma's native check-in success toast (Simplified Chinese UI).
 *
 * Evidence (read-only, user-authorized single check-in on the attendee-detail view of the
 * /guests route): after the native "check in" button succeeded, Luma briefly rendered an
 * element with role="status" and the exact text "已签到。" and also left an aria-live="polite"
 * element with the same text. Nothing else is consumed.
 *
 * NOT verified: that the same toast appears for a QR scan on /scan (no camera was available),
 * what failure/duplicate/invalid UI looks like, and any other locale. Those are never matched.
 *
 * Rule: success = at least one element with role="status" whose trimmed text is exactly
 * SUCCESS_TEXT; count = how many are visible right now. The toast text carries no guest
 * identity, so identity is deliberately not invented: the detector's lifecycle (see
 * detector.js and docs/DETECTION.md) decides how many check-ins that represents. The
 * aria-live clone, counters, labels and buttons are ignored. This profile is stateless.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUCCESS_TEXT = '已签到。';

  const profile = {
    id: 'luma-native-success-toast-zh-v1',
    verified: true,
    read(root) {
      let count = 0;
      for (const el of root.querySelectorAll('[role="status"]')) {
        if ((el.textContent || '').trim() === SUCCESS_TEXT) count += 1;
      }
      return count ? { state: 'success', count } : { state: 'idle' };
    },
  };

  return { profile, SUCCESS_TEXT };
});
