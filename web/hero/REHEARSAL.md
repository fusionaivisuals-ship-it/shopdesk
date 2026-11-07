# Rehearsal: ShopDesk hero (D-46)

Gold copied: `ai-chat` (stage 640x420, window pinned top and sides, runs off the bottom, composer, Collapse + Stream).

Changed:
- Story: two-part question -> three tool steps (verify_customer, list_orders, search_policy), each pending then done (kit `Check`) -> one streamed answer -> one source chip, "Shipping policy · v1".
- Accent #a4553a (Glow & Co clay); success green only on the done ticks (status color).
- Removed an unsupported claim from the answer ("tracking link is in your email": no tool returns that).
- Compact (358x344): a second design, cropped harder; the window bleeds right and bottom; the question starts already sent; no composer; no greeting.

Filmed (2026-11-08, Chromium 1243, headless, virtual clock):
- Stills at 1280 and 390: no issues of ours. Kit line on the window title bar inset also appears on the gold.
- Loop with --gate at 390: rehearsal passed.
- Loop with --gate at 1280: fails on the same lines the gold ai-chat fails on (kit title-bar inset; field width growing while typing). Nothing else.

Not checked:
- Dark theme (not requested).
- Real-browser frame rate on a phone.
- An independent fresh-eye review (references/review.md) by someone who didn't build it.
