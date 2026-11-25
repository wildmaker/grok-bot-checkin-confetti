# Success detection status

## What is known (from official docs and a read-only authenticated look at the scan page)

- Luma's official check-in docs describe Standard Mode (confirm after scan) and Express Mode (auto check-in
  after scan); invalid tickets show a "not valid" state. There is no public check-in write API, and this
  extension makes no API calls.
- The scan page shows camera permission UI, a Standard/Express mode selector, a confirmation button, a
  ticket-type restriction switch, an empty alert region, and checked-in / attendee counters.
- No success, error, or duplicate state has been observed, so **no success selector or text is verified**.
  Counter values and mode labels are explicitly *not* accepted as success evidence.

## Current behaviour (fail-closed)

`src/profile.js` is `verified: false`. The detector never fires for an unverified profile, so the production
build shows bots only. The MutationObserver is not even installed.

## Contract a verified profile must satisfy

```
profile = { id, verified: true, read(root) -> { state, signature? } }
state: idle | success | failure | duplicate | pending | nomatch | unknown
```

- `success` only for the real "this guest was just checked in" UI, never for failure, duplicate, pending,
  invalid, or no-match, and never for static counters or labels. Mixed/ambiguous DOM must return `unknown`.
- `signature` (optional) is an in-memory string that differs between guests (e.g. derived from the result
  card). It is hashed, never stored or logged. It lets two different guests shown back to back both celebrate.
- Dedup is lifecycle based, with no time window: an event fires when the state enters `success` from
  `idle/failure/duplicate/pending/nomatch`, or when the signature changes while still `success`. Re-renders
  of the same result do not repeat; `unknown` never resets the lifecycle. A success already visible at mount
  is the baseline and is not celebrated.
- If the real success UI has no per-guest signal, two guests shown back to back with no state between them
  cannot be told apart; that limitation must be documented with the evidence.

## What parent/evidence must supply before enabling

Sanitized structure only (roles, ARIA attributes, element nesting, class-name shape, insertion/removal
timing), for Standard and Express modes: success, "not valid", already-checked-in, pending/confirm, and
no-match. No names, emails, QR payloads, or event-specific HTML.

Then: write the profile, add a synthetic fixture that mirrors that structure, extend the tests, and flip
`verified` only when the unit and e2e suites cover each state above.
