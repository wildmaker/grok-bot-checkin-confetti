# Success detection

## Verified signal (native toast) vs unverified path (QR scan on /scan)

| Item | Status |
| --- | --- |
| Luma's native "check in" button on an attendee-detail view (`/guests` route), Simplified Chinese UI, renders an element with `role="status"` and the exact text `已签到。` right after a successful check-in | **Observed** (read-only, one user-authorized check-in) |
| An `aria-live="polite"` element with the same text lingers afterwards | **Observed**; deliberately never used as a trigger |
| The same toast appears after a QR scan on the `/scan` page (Standard or Express mode) | **Not verified** (no camera available) |
| Failure / duplicate / "not valid" / pending UI on the scan page | **Not observed**; never matched |
| Other locales (e.g. English wording) | **Not observed**; no selector or text is guessed |

The extension runs on `/check-in/<id>/scan`, consumes only the first (verified) toast signal, and therefore
makes this assumption explicitly: *if* the scan flow shows the same native toast, it celebrates; if the scan
flow uses a different mechanism, it simply stays silent (a missed celebration, never a false one). The
toast text is the only detection rule. It is not live QR-scan acceptance.

## Rule (`src/profile.js`, `luma-native-success-toast-zh-v1`)

- Trigger: an element matching `[role="status"]` whose trimmed `textContent` is exactly `已签到。`.
- Ignored: the `aria-live` clone, counters (`已签到 N`), row/dialog labels (`已签到 现在`), the `撤销签到`
  button, button clicks, any other text or role. No whole-page text search.
- One distinct toast node = one check-in. The signature is an in-memory node counter (no page data).
  - Same node staying on screen, rewritten, or re-rendered with row/counter updates: no repeat.
  - A new toast node while an older one is still visible (a different guest right after): counts again.
  - Removing the older toast while a newer one remains: no repeat.
  - The lingering `aria-live` clone never counts, so "transient toast then persistent clone" is one event.
- Baseline: toasts already present when the scan route is entered (initial load or SPA entry) never celebrate
  (`detector.prime`). Only toasts that appear afterwards do.
- Detector is otherwise fail-closed: unrecognised state, thrown errors, or an unverified profile never fire.

## Known limits

- If Luma re-keys a still-visible toast (remounts the node) the new node counts as a new check-in.
- If a second check-in reuses the very same toast node without removing/replacing it, it is not seen.
- Pending/failure/duplicate states are not modelled until their real UI is observed; add them to the profile
  with fixtures only after sanitized structural evidence exists (roles, ARIA, nesting, timing; no guest data).
