# First Command — real-engine tutorial preview

Run `node prototypes/tutorial-campaign/server.cjs` from the repository root and open http://127.0.0.1:4188/?browserTest=1. The previous preview URL redirects here.

This runs the actual game entry point through its existing Vite configuration: deterministic engine, Canvas renderer, terrain, artwork, native controls, menus and illustrated help. A local-only injected coach uses the existing development bridge to start a reproducible paused match, observe outcomes and project world anchors. No production game files or releases are changed.

The 17-step opening requires actual zoom/pan, economy/attack settings, native pause, a city from the build menu and a factory placed through the game's F mode. Gold deductions and placement restrictions are real. Factory construction runs for the full 150 simulation ticks (15 seconds) before the coach pauses the engine. Show target uses the camera's actual projection; unit explanations open the existing game guide.

This is an opening lesson and free-practice demo, not the complete nine-chapter campaign. The later chapters remain specified in `docs/tutorial-campaign-design.md`. Training uses local custom starting resources and Paused orders, with no WordPress account connection. Restart lesson reloads a fresh fixture. Free practice leaves the real match paused for the player to resume.

Regression: `npx playwright test --config prototypes/tutorial-campaign/playwright.config.cjs --project=chromium`. The test server is isolated on port 4190. Chromium passed the complete sequence, including frozen time, camera controls, real gold deductions, native placement, 150 construction ticks and guide pause preservation. Firefox was blocked by the local SSLKEYLOGFILE privacy warning; WebKit did not complete and was interrupted. Neither is claimed verified. No production release qualification was performed for this local prototype.
