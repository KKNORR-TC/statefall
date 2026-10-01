# Field guide and allied aid — 1.10.61

## Scope

The app and packaged website use `game/src/help-guide.mjs` for all eight help tabs. Large current gameplay portraits introduce each topic. Opening moves and reinforcement orders use short numbered sequences; combined-arms advice pairs practical actions with units. Detailed rules remain available in native keyboard-accessible disclosures, rather than wide tables. Mobile layouts stack the illustrated sections.

About now describes the current game, audio, account features and latest player-facing changes. `help-release.mjs` must match both version and build; the package build rejects a stale note. This is a standing requirement in AGENTS.md and the release runbook. Credits retain That Company and Natural Earth and identify the CC BY audio source.

## Critic pass

- Replaced the repeated dense tables and long introductory paragraphs with distinct visual hierarchy and shorter reading paths.
- Preserved the forty existing unit/building portraits and tactical advice.
- Corrected the stale About version, old generative-music description, Normal difficulty behavior and ordinary-versus-heavy transport advice.
- Preserved the website plugin's own navigation: the embedded navigation retains the exact wrapper its shortcode removes. Standalone flat pages now link to the correct sibling pages.
- Reset the app guide's reading position when switching tabs.
- Reviewed desktop and 390px screenshots of Basics, Systems, Garrisons, Modes and About. The first mobile pass still narrowed tactic text too much, so those illustrations now stack above the copy.

## Ally-sharing review

Reviewed the conversation titled “Fix ally troop and gold sharing” and its shared source changes. Ken confirmed the failing case was Billionaire mode or a balance above four million. A one-million command boundary rejected the default 250-million aid amount; the menu also submitted both inputs, so an unused gold value could prevent sending troops.

The fix raises the shared finite amount limit to one billion, caps initial field values, validates the selected amount and sends zero for the unused field. Existing resource transfer routines still cap spending to the sender's balance. The browser regression checks both sender and recipient balances, independently invalid unused inputs, command payloads and rejection without mutation. Command tests retain negative/nonfinite/over-limit rejection and replay acceptance. No unrelated economy changes were needed.

## Release status

Published on 30 September 2026 at 22:01:14 UTC after full release qualification. Live acceptance passed; see the [release record](release-record-1.10.61.md).

Earlier development checks completed on 30 September 2026:

- `npm run verify:fast` passed, including all Node suites, replay checks and `DETERMINISTIC ✓` (85/85 commands, matching final state).
- `npm run build:game` passed; About metadata matches 1.10.61 / 2026-09-30-field-guide-ally-aid.
- Fifteen focused browser checks passed across Chromium, Firefox and WebKit: all guide tabs at desktop and narrow widths, keyboard disclosures, About freshness, app tab switching, all forty portraits and actual Billionaire allied transfers.
- The first browser run had one Firefox portrait-load timeout with pending image requests, not a content assertion mismatch. The complete final run passed after the mobile layout refinement. Retain this observation for the wider release browser run; it has not been classified as a fixed application defect.
- `git diff --check` passed. Node's existing automatic ESM detection warnings and Vite's existing large-bundle advisory are informational; this does not substitute for the performance gate.
- Evidence is under `docs/evidence/field-guide-1.10.61/`. Docker was not started and no production operation occurred.

The subsequent full uninterrupted qualification passed, including exact-artifact Docker installation, reproducibility and performance gates. The earlier Firefox timeout did not recur. Production is game 1.10.61 / plugin 1.10.10; caches are cleared and 1.10.60 remains available for rollback. Full release evidence is under `docs/evidence/release-1.10.61/`. Docker is stopped.
