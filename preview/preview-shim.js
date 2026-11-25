/*
 * The only adaptation between the real content script and this demo page: the real route gate
 * only accepts https://luma.com/check-in/<id>/scan, so here the demo page asks the same gate
 * about a virtual scan URL. Everything else (detector, profile, overlay, queue) is untouched.
 * `chrome.storage` does not exist on a normal page; content.js already tolerates that, so
 * pause/hide simply do not persist across reloads in the demo.
 */
(function () {
  const G = globalThis.GrokBotCheckin;
  const realGate = G.isScanLocation;
  const virtualScanUrl = new URL('https://luma.com/check-in/evt-SYNTHETIC-DEMO/scan');
  G.isScanLocation = (loc) => (loc && (loc.pathname === '/' || loc.pathname === '/index.html') ? realGate(virtualScanUrl) : false);
})();
