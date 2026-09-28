# Hosted startup failure — 28 September 2026

The game 1.10.49 installation displayed unstyled HTML and never started. The earlier local GO did not establish production acceptance and is superseded by a release hold for plugin 1.10.8.

With Ken's explicit read-only approval, public HTTP inspection confirmed that the page returns 200 but its initial JavaScript, preload helper and stylesheet under /play/releases/ all return 404. All three corresponding physical files under /wp-content/uploads/statefall/releases/ return 200 with the correct MIME types. [Request evidence](evidence/plugin-1.10.9/production-read-only.json). No production files or settings were changed.

The plugin generated virtual URLs dependent on WordPress rewrite handling for static files. The live host does not serve these URLs. The local Apache sandbox does, so the previous exact-package test passed without exercising this hosting behavior. This was a gap in release qualification.

Plugin 1.10.9 changes the runtime base to the installed physical uploads directory. Both injected entry URLs and the runtime asset configuration use the same immutable release directory. Existing virtual routes remain available on servers that support them. Game files and simulation behavior are unchanged.

The browser gate now opens plain /play/, checks that startup completes and CSS applies, and repeats the exact-package test with every virtual /play/releases/ request returning 404. It still verifies game start, upgrade artwork, terrain worker creation and no failed requests. The exact replacement ZIP passed local qualification, including both hosting cases. See [the corrective release record](release-record-plugin-1.10.9.md). Live acceptance remains pending.
