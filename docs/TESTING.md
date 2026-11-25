# Testing

## Layers

1. **Unit** (`tests/unit`, `node:test`, no DOM library): route gate and watcher (Navigation API and fallback), detector
   lifecycle, the native-toast profile against fake nodes (exact text/role matching, near misses, baseline, overlapping
   guests, clone ignored, empty-then-filled), celebration queue cap, manifest/permissions, no network/cookie/
   click-interception code, and a byte-reproducible ZIP that contains no test material.
2. **Browser extension** (`tests/e2e/extension.spec.cjs`, Playwright + real Chromium, MV3 unpacked `dist/extension`):
   a local HTTPS server maps `luma.com` to 127.0.0.1 so the real manifest match pattern is exercised, with a strict
   CSP (`style-src 'self'`). The fixture app is a tiny client-side router (real `history.pushState` navigation) with
   generic localized strings: a `role="status"` `已签到。` toast, a lingering `aria-live` clone, counter, row status,
   and `撤销签到` button. It contains no guest data and no captured Luma markup.

## Covered

Load/no console errors; scan-route-only mounting; SPA enter/exit/back/forward/re-entry; pointer pass-through; page
CSS cannot restyle the overlay; pause/hide persistence; reduced motion; narrow viewport; one celebration per
toast; empty-then-filled toast; rewrite/re-render with row/counter/button updates; transient toast then
`aria-live` clone (gap and overlap) = one; clone alone, near-miss texts, wrong roles, English text = none; toast
present at load or before SPA entry = none; overlapping guests, sequential guests and a persistent clone all
counted correctly; no observer leaks across route re-entry; pending cap, <=160 particles, DOM drains.
The detector lifecycle cases are tagged SUPPORTED or AMBIGUOUS in the tests and mirror the table in `docs/DETECTION.md`
(including React remount, cleared-then-refilled node, coexisting toasts, clone persistence with toast recurrence, and
the ambiguous same-tick swap that is counted once). A mutation check (matching the `aria-live` clone too) makes the
double-celebration test fail.

The fixture page is bannered `SYNTHETIC FIXTURE - not Luma, no guest data`; the screenshots and the preview video
are of that fixture.

## Not covered

- **Live QR scan on /scan**: no camera was available. The toast was observed on the attendee-detail check-in only.
- Scan failure/duplicate/invalid UI, Express mode, other locales.
- Normal branded Chrome cannot side-load via flags (Chrome 137+); e2e uses Playwright's Chromium. Install in
  normal Chrome via Load unpacked.
