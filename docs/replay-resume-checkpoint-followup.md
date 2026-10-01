# Saved-match checkpoint history follow-up

Discovered during 1.10.62 production acceptance, 1 October 2026 UTC.

The existing account replay GUIDE1061LIVE, recorded by game 1.10.61 after resuming a save, is rejected before playback with `Invalid replay: hashes is missing checkpoint 100`. The established HELP1060SCORE recording completes on 1.10.62 and reports an exact match throughout.

The pause patch does not modify replay validation or simulation. Inspection of `game/src/sim/deterministic-runtime.mjs` shows `takeOverReplay()` copies the consumed command log but does not copy the replay's earlier hash checkpoints into command history. This is the likely source of missing historical checkpoints when a resumed match is saved again; reproduce with a save past tick 100 before implementing the repair. Do not weaken checkpoint validation or fabricate missing hashes in existing recordings.

Follow-up acceptance: save after several checkpoints, resume, issue an order, save again and complete the match. Validate and replay both the second save and completed recording in Chromium, Firefox and WebKit. Preserve hashes up to the takeover tick, discard future hashes, and append newly generated checkpoints exactly once. Cover a non-checkpoint takeover tick and repeated resume cycles. Qualify any repair as a separate release using the full mandatory gates.

No production recording was changed or deleted. This is a pre-existing recording-integrity issue, not an observed simulation divergence or pause-patch regression.
