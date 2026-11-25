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

## Rule (`src/profile.js` + `src/detector.js`)

The profile is stateless: success = at least one `[role="status"]` element whose trimmed text is exactly
`已签到。`; `count` = how many are visible right now. Ignored: the `aria-live` clone, counters (`已签到 N`),
row/dialog labels, the `撤销签到` button, clicks, any other text or role, any whole-page text search.

The toast text carries **no guest identity**, and none is invented. How many check-ins it represents is decided by
the detector lifecycle, whose state is three scalars (active, last count, last signature hash; no DOM node
references, nothing persisted or logged). An event fires when:

1. success appears after a non-success state (nothing visible at the previous evaluation), or
2. more success toasts are visible at once than at the previous evaluation (one event per extra), or
3. a profile-provided in-memory signature changes while success stays visible (unused today; reserved for a
   real per-guest field if its structure is ever observed).

Toasts present when the scan route is entered are the baseline and never celebrate.

## Exactly-once classification

"Exactly one celebration per actual guest" cannot be proven from this UI alone, because every guest's toast is
the same text. What can and cannot be distinguished from the visible DOM:

| Case | Result | Class |
| --- | --- | --- |
| One toast appears | 1 | Supported |
| Same toast re-rendered, text rewritten, row/counter/button updates | 1 | Supported |
| React remount: visible toast replaced by an identical node in the same step | 1 (no duplicate) | Supported |
| Same node cleared (no toast visible), then success again | +1 | Supported |
| Toast gone, a later toast appears | +1 each | Supported |
| Second toast visible alongside the first | +1; removing the older adds nothing | Supported (coexisting toasts are distinguishable) |
| Persistent `aria-live` clone + transient toast, once or recurring | clone never counts; +1 per toast appearance | Supported |
| Toast present before route entry (initial load or SPA entry) | 0 | Supported |
| Guest B's identical toast replaces guest A's visible toast within one evaluation tick | 1 | **Ambiguous**: indistinguishable from a remount; counted once (may undercount) |
| A second check-in that reuses the same visible node and text without it ever disappearing | not seen | **Ambiguous**: undercount |
| A toast library that keeps the old node in the DOM (exit animation) while the new one appears, for one guest | 2 | **Ambiguous**: may overcount; parent should confirm how Luma removes toasts |
| QR scan on `/scan` shows the same toast | unknown | **Unverified** |
| Failure/duplicate/invalid UI; English or other locales | never matched | **Unverified** |

Policy: when the visible UI cannot tell two situations apart, the detector counts once (no duplicate). It never
claims exactly-once. If the real toast DOM exposes a per-guest field in the current result view, an ephemeral
in-memory signature can be added to the profile and the lifecycle above already handles it.

Evaluations run on a 50 ms throttle after DOM mutations; "nothing visible" means nothing visible at an evaluation
tick, so a toast that vanishes and returns inside one tick is treated as one.

## What evidence would close the remaining gaps

Sanitized structure only (roles, ARIA attributes, nesting, class-name shape, insertion/removal timing): the toast
after a real QR scan on `/scan` (Standard and Express), how Luma removes/replaces toasts, any per-guest field in
the visible result, and the failure/duplicate/invalid UI. No names, emails, QR payloads or event-specific HTML.
