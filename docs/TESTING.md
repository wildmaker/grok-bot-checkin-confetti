# Testing

## Layers

1. **Unit** (`tests/unit`, `node:test`, jsdom): route gate, route watcher (Navigation API and fallback),
   detector lifecycle/dedup/fail-closed behaviour, celebration queue cap, manifest/permission assertions,
   production build contains no synthetic profile, ZIP is byte-reproducible and loadable.
2. **Browser extension** (`tests/e2e`, Playwright + real Chromium, MV3 unpacked):
   - `prod.spec.cjs` loads `dist/prod` (shippable, fail-closed).
   - `synthetic.spec.cjs` loads `dist/test`, identical except `profile.js` is the synthetic profile.
   A local HTTPS server maps `luma.com` to 127.0.0.1 so the manifest match pattern is exercised for real. It
   serves a strict CSP (`style-src 'self'`) to prove the constructable stylesheet is not blocked. The fixture
   app is a tiny client-side router, so SPA entry from `/event/...` is real `history.pushState` navigation.

## Covered

Load/no console errors, scan-route-only mounting, SPA enter/exit/back/forward/re-entry (one host), pointer
pass-through (`elementFromPoint`, real clicks under bots), page CSS cannot restyle the overlay, pause/hide
persistence, reduced motion, narrow-viewport bot count and no overlap with the central panel, fail-closed
production detector, single celebration per success, no repeat on re-render, failure/duplicate/pending/
no-match/ambiguous never celebrate, different guests back to back both celebrate, later guests celebrate,
pre-existing success not celebrated, off-route markers ignored, queue cap and particle/DOM bounds.

## Not covered (be honest)

- **Live Luma**: nothing here touches luma.com. The real success/failure/duplicate DOM is unverified, so a
  green run says nothing about live celebrations. Live acceptance needs a human with event access and only
  the designated test guest, and sanitized observations (see DETECTION.md).
- Camera behaviour: the extension never touches it; fixtures use a plain div, not a real camera.
- Branded Chrome stable cannot side-load via flags (Chrome 137+); the e2e run uses Playwright's Chromium.
  Manual load-unpacked in normal Chrome is the install path.
