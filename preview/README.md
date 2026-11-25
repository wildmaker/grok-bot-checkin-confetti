# Grok Bot Check-in Confetti - synthetic local preview (BETA)

> **This is a SYNTHETIC DEMO.** Nothing here is Luma, a scanner, or a real guest. A green demo is **not**
> acceptance of the real scanner. The extension has not been validated against a live QR scan on Luma's
> check-in page; see "Known limitations" below.

## Run it (no Node, no internet, no install)

Needs only `python3` (standard library). From this folder:

```sh
./start.sh            # or: python3 serve.py
```

Then open **http://127.0.0.1:8765/**. Use `./start.sh 8766` (or `PORT=8766 python3 serve.py`) if 8765 is taken.
Stop with Ctrl+C. The server binds to localhost only and serves just this folder.

## What you will see

- A yellow **SYNTHETIC DEMO** banner and a placeholder where a camera would be. No camera, network, or Luma access.
- Four floating Grok Bot icons at the screen edges with a slow drift, and **Pause bots / Hide bots** at the bottom-left.
- Buttons that add fake page elements. The *real* extension scripts in `extension/` (unmodified) watch the page:

| Button | What it adds | Expected |
| --- | --- | --- |
| Simulate check-in success | a `role="status"` toast with the exact native success text | 1 celebration |
| Two guests, overlapping toasts | two such toasts 0.7 s apart | 2 celebrations |
| Success, then toast re-rendered | one toast, then an identical replacement node | 1 celebration (no duplicate) |
| Repeated scan (synthetic wording) | a made-up "already checked in" status | none |
| Failure / not valid (synthetic wording) | a made-up "not valid" status | none |
| Toggle aria-live clone | a lingering `aria-live` element with the success text | never counts |

The counters show what the extension itself reports. "Repeated" and "failure" use invented wording because the real
Luma duplicate/failure screens have never been observed; the point is that unrecognised statuses are ignored.

The only demo-specific code is `preview-shim.js`: the real route gate only accepts `https://luma.com/check-in/<id>/scan`,
so the demo asks that same gate about a virtual scan URL. Pause/hide do not persist across reloads here
(`chrome.storage` does not exist on a normal page).

## The extension itself

`extension/` is the unpacked Chrome MV3 extension (load it via `chrome://extensions` > Developer mode > Load unpacked),
and the matching `*-load-unpacked.zip` has the same contents. It only decorates the page: it does not scan, check in,
call any API, read cookies, or intercept clicks or the camera.

## Known limitations (BETA)

- **Not validated on the real scan page.** The success signal (`role="status"` with the exact text `已签到。`) was observed
  only on the attendee-detail check-in, not after a QR scan on `/scan`. If the scan flow shows something else, nothing celebrates.
- **Chinese UI only.** English and other locales are never matched.
- **Failure / duplicate / invalid screens on the scan page have never been observed**, so they are never matched
  (no celebration, but also no dedicated handling).
- **"One celebration per guest" is not guaranteed.** The toast text has no guest identity. Supported: one toast = 1, re-render or
  remount of the visible toast = no duplicate, toast gone then a later one = +1, coexisting toasts = +1 each, the `aria-live` clone
  never counts. Ambiguous and counted once (may undercount): a different guest's identical toast replacing the visible one within
  one 50 ms check, or reusing the same node without it ever disappearing. Ambiguous and counted twice (may overcount): a toast
  library that keeps the old toast in the page during an exit animation. Details: `docs/DETECTION.md` in the source repo.
- Toasts already on screen when the scan page is entered never celebrate.
- Celebrations are capped (one at a time, six waiting, at most 48 particles). Under `prefers-reduced-motion` the bots do not drift
  and a success is a brief opacity pulse with no particles.
- No release tag, no store listing; experimental source.

## Notices

Unofficial; not affiliated with or endorsed by xAI or Luma. The Grok Bot mark is copied from https://x.ai/bot and remains the
property of its owner; no licence is claimed (see `ASSETS.md`). The demo contains no guest data, event IDs, or captured Luma markup.
