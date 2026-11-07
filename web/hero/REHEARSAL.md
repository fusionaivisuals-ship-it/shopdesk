# Rehearsal: ShopDesk hero, Botanical look (D-46, D-47)

Gold copied: `ai-chat` (stage, pinned panel running off the bottom, Collapse + Stream), then redesigned:
- Chrome for the task: a shop's chat widget (serif wordmark, Online badge, pill composer), not a desktop window.
- Botanical look (D-47): forest-green ground (kit `ground` orbs), cream surface, green accent; customer bubble in the accent.
- Story unchanged (D-46). The answer contains only facts the tools return.
- Tool steps marked by a soft left rule, results beside them; a real greeting instead of placeholder bars.
- Compact (358x404): the widget whole between 16px gutters, off the bottom; question starts sent; steps stack.

Filmed 2026-11-08, Chromium 1243 headless, virtual clock:
- Gate at 1280: rehearsal passed (only remaining line: the field growing while typing, which the gold also shows).
- Gate at 390: rehearsal passed.
- Fixed during rehearsal: typed question overran the field; uneven gutters on phones (panel bleed); tool list hop on landing; tight name/result stack on phones; source chip cut by the phone crop.

Not checked: dark theme (page is light-only for now); a real iPhone in Safari. Independent fresh-eye review: see below.
Fixed 2026-11-08 (later): the air above the greeting on desktop (stage 640x412).

Live check (real clock, Chromium emulating iPhone 13, and desktop 1280): plays to the end, median frame 16.7ms, 0 frames over 50ms, 0 console errors. Not a real iPhone/Safari.

## v3, after the independent fresh-eye review (2026-11-08)

A reviewer that never saw this file or the reasons judged the frames against the gold. 12 findings:
- Fixed 10. Main changes: the widget now sits on the Glow & Co shop page (nav, hero, tiles) like a real support widget, not floating on a plate; customer bubble tinted (accent-soft, dark text) instead of solid green; top of the thread fades; answer text 14px/450; source chip in forest green #2f5d46; phone crop shows the panel bleeding off the right edge.
- Kept #6 (combined question): the question is now two short messages ("GC-1043, mei.lin@example.com. Where is it?" then "Also, do you ship to Japan?"), the story stays D-46.
- Kept #10 (plays once): intended, like the ai-chat gold; the still is the payoff.
- Greeting hidden on phones (it clipped); desktop stage 640x492, panel 472px so the first question clears the fade.

Filmed again, Chromium 1243 headless:
- Gate at 1280: rehearsal passed (only line: field growing while typing, a kit-level behavior the gold shares).
- Gate at 390: rehearsal passed (only line: a 1px placeholder bar inside the top fade, accepted).
- Live check, real clock, Chromium emulating iPhone 13 and desktop 1280: 866/847 frames, median 16.7ms, 0 over 50ms, 0 errors. Not a real iPhone/Safari.
