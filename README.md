# Grok Bot Check-in Confetti (unofficial, BETA)

> **Experimental beta. Not production-ready, no release tag.** The live QR-scan path on Luma's check-in page has not been validated.
> Try the [synthetic local preview](#try-the-synthetic-preview-no-luma-needed) first.

A Chrome Manifest V3 extension that decorates the official Luma web check-in scanner page
(`https://luma.com/check-in/<event>/scan`) with small floating Grok Bot icons and, once a
native check-in success toast appears, plays a full-screen confetti celebration per check-in.

It only decorates the page. It does not scan, approve, check in, call any API, read cookies or
tokens, hook `fetch`/the camera, or intercept clicks. All overlay elements use `pointer-events: none`
(except two small pause/hide buttons in the bottom-left corner).

> **Status (v0.3.0):** confetti is driven only by Luma's native Chinese success toast (`role="status"`,
> exact text `已签到。`), which was observed on the attendee-detail check-in. That the same toast appears after a
> QR scan on `/scan` is **not verified**, and scan failure/duplicate UI is unobserved. See
> [docs/DETECTION.md](docs/DETECTION.md), which also classifies which "one celebration per guest" cases are supported and which are
> ambiguous (counted once, never claimed exactly-once). Automated tests use local fixtures and are not live Luma acceptance.

Not affiliated with or endorsed by xAI or Luma. See [ASSETS.md](ASSETS.md) for the icon source and trademark notice.

## Try the synthetic preview (no Luma needed)

Needs only `python3`. `npm run build` writes `release/grok-bot-checkin-confetti-preview-v0.3.1.zip`; unzip it and run
`./start.sh`, then open <http://127.0.0.1:8765/>. It runs the real extension scripts against a clearly bannered
**SYNTHETIC DEMO** page with buttons for simulated success, overlapping guests, re-render, repeated and failure. A passing
demo is **not** real-scanner acceptance. Details: [preview/README.md](preview/README.md).

## Install (load unpacked)

1. `npm install && npm run build` writes `release/grok-bot-checkin-confetti-v0.3.0-load-unpacked.zip` (needs the `zip` CLI), or use a prebuilt ZIP.
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
| `src/overlay.js`, `overlay.css` | Open Shadow DOM, constructable stylesheet, drifting bots, WAAPI confetti: two corner cannons, a bot burst, top rain, shock rings and a check-in badge (max 160 particles) |
| `src/content.js` | Mount/unmount per route, settings, throttled MutationObserver (only when a verified profile exists) |
| `src/profile.js` | Detection profile: exact native `role=status` `已签到。` toast only |

Motion respects `prefers-reduced-motion` (drift off; a success is acknowledged with a brief opacity pulse, no particles).
Bots are paused while the tab is hidden for celebrations and when the user pauses or hides them.

## Known limitations (beta)

- Success is detected only from the native `role="status"` toast with exact text `已签到。`, observed on the attendee-detail
  check-in. That the same toast appears after a QR scan on `/scan` is **unverified**; if not, nothing celebrates.
- Chinese UI only. Scan failure/duplicate/invalid screens were never observed and are never matched.
- "Exactly one celebration per guest" is not claimed: the toast has no guest identity. Some cases may undercount or overcount;
  see the supported/ambiguous table in [docs/DETECTION.md](docs/DETECTION.md).
- Tests use local fixtures and a synthetic demo, never luma.com.

## Tests

```
npm test            # build, unit tests (node:test), real-Chromium MV3 e2e (Playwright)
npm run test:unit
npm run test:e2e    # needs: npx playwright install chromium
```

E2E loads the unpacked extension in real Chromium against a local HTTPS server that maps `luma.com`
to 127.0.0.1 and serves synthetic pages. It never contacts Luma. Details and limits: [docs/TESTING.md](docs/TESTING.md).
