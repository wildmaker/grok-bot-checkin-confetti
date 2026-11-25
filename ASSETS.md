# Asset provenance and notices

## Grok Bot mark (`assets/grok-bot-mark.svg`)

- Source: inline SVG on the official Grok Bot page, <https://x.ai/bot>, element
  `svg.grok-bot-mark.grok-bot-mark--fill` (viewBox `0 0 100 100`; one `grok-bot-mark__head` path and two
  `grok-bot-mark__eye` paths). Retrieved 2026-11-25.
- Path geometry is copied unmodified. Only presentation was changed: the head is filled `#885cf5` (the
  default agent colour used by that page's CSS) and eyes `#ffffff`. The overlay re-colours the head per bot.
- SHA-256 of the file: see `sha256sum assets/grok-bot-mark.svg` (recorded in the release notes).
- Extension icons in `assets/icons/` are renders of the same SVG (`scripts/make-icons.mjs`).
- It is not the Grok app logo or the X logo. Those are different marks and are not used.

## Trademark / no affiliation

"Grok", "Grok Bot", and "xAI" are trademarks of their respective owners. This project is an unofficial,
independent extension; it is not affiliated with, sponsored, or endorsed by xAI or Luma. No licence to the
mark is claimed or granted by this repository. xAI's brand guidelines (<https://x.ai/legal/brand-guidelines>)
could not be retrieved when this was assembled; the mark is used at the requester's direction to refer to
Grok Bot. If you represent the mark owner and want it removed or replaced, replace `assets/grok-bot-mark.svg`
and rebuild.
