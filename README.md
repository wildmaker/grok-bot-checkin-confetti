# Grok Bot Check-in Confetti (unofficial)

A Chrome Manifest V3 extension that decorates the official Luma web check-in scanner page
(`https://luma.com/check-in/<event>/scan`) with small floating Grok Bot icons and, once a
verified check-in success signal exists, plays a one-bot confetti burst per check-in.

It only decorates the page. It does not scan, approve, check in, call any API, read cookies or
tokens, hook `fetch`/the camera, or intercept clicks. All overlay elements use `pointer-events: none`
(except two small pause/hide buttons in the bottom-left corner).

> **Status: detection is not verified.** No real Luma success signal has been confirmed yet, so the
> shipped production profile is fail-closed: bots float, but nothing celebrates. See
> [docs/DETECTION.md](docs/DETECTION.md). Automated tests use synthetic fixtures only and are not
> live Luma acceptance.

Not affiliated with or endorsed by xAI or Luma. See [ASSETS.md](ASSETS.md) for the icon source and trademark notice.

## Install (load unpacked)

1. `npm install && npm run package` (or use a prebuilt `grok-bot-checkin-confetti-v0.1.0-load-unpacked.zip`).
2. Unzip it to a folder (the ZIP root contains `manifest.json`).
3. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, select the folder.
4. Open the Luma check-in scan page. Bots appear at the screen edges; use **Pause bots** / **Hide bots** (bottom-left) to stop or hide them. Settings persist via `chrome.storage.local`.

Permissions: `storage` only (to remember pause/hide). Content script matches `https://luma.com/*` so it
can notice client-side navigation into `/check-in/<id>/scan` (Luma is a single-page app); it does nothing
on any other path and runs no code besides route checks there.

## How it works

| File | Role |
| --- | --- |
| `src/route.js` | Exact path gate `^/check-in/[^/]+/scan/?$` on `https://luma.com`; Navigation API route watcher (popstate/poll fallback) |
| `src/detector.js` | Fail-closed success detector contract, lifecycle-based dedup, in-memory hashed signature |
| `src/queue.js` | One celebration at a time, hard pending cap |
| `src/overlay.js`, `overlay.css` | Open Shadow DOM, constructable stylesheet, drifting bots, WAAPI confetti (max 48 particles) |
| `src/content.js` | Mount/unmount per route, settings, throttled MutationObserver (only when a verified profile exists) |
| `src/profile.js` | Production profile: `verified: false` |
| `test-support/synthetic-profile.js` | Synthetic profile used only by the test build |

Motion respects `prefers-reduced-motion` (drift off; a success is acknowledged with a brief opacity pulse, no particles).
Bots are paused while the tab is hidden for celebrations and when the user pauses or hides them.

## Tests

```
npm test            # build, unit tests (node:test + jsdom), real-Chromium MV3 e2e (Playwright)
npm run test:unit
npm run test:e2e    # needs: npx playwright install chromium
npm run package     # release/*.zip
```

E2E loads the unpacked extension in real Chromium against a local HTTPS server that maps `luma.com`
to 127.0.0.1 and serves synthetic pages. It never contacts Luma. Details and limits: [docs/TESTING.md](docs/TESTING.md).
