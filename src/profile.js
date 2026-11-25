/*
 * Production detection profile: intentionally UNVERIFIED and fail-closed.
 *
 * No Luma success signal has been observed and verified yet, so no selectors are guessed
 * here. Until a real signal is documented (see docs/DETECTION.md), the extension shows its
 * floating bots but never celebrates. Page text such as a "checked in" counter or any
 * label is not accepted as success evidence.
 */
(function (root) {
  root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, {
    profile: {
      id: 'luma-scan-unverified',
      verified: false,
      read() {
        return { state: 'unknown' };
      },
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
