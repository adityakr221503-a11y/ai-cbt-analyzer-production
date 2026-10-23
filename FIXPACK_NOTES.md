# RankForge — what changed (v4)

## One look, two themes
- rf-theme.css + rf-shell.js: the Home screen's premium design now runs on every page. Dark / Light / Auto (More ▸ Appearance, or the sun/moon button).
- App bar with a real Back button on every inner page; bottom tabs (Home · Learn · Practice · Tests · Progress · Nexus). Exam mode hides both bars.
- Old pages are skinned automatically at runtime (surfaces, buttons, inputs, text contrast). Legacy sticky headers and bottom bars are moved or hidden so nothing overlaps.
- CBT exam screen rebuilt: large readable question + options, real list/table rendering, clean palette, big result cards.

## Features
- Subject Practice (Biology · Physics · Chemistry · Mixed PCB) with chapter filter and "generate more with free AI". Physics/Chemistry use the verified Test 180 questions plus anything you import or generate.
- Free AI, two routes: paste a free Google Gemini key (no server) or deploy the Cloudflare Worker (free Workers AI). Owner Hub ▸ Free AI tests either.
- Nexus (NotebookLM-style): sources, grounded chat with citations (AI-written when Gemini is on), study guide, flashcards/study tools, source-grounded quizzes, predict. AI quiz questions are rejected unless their quote exists in your sources.
- Bookmarks, report share/download, marks with +4/−1.

## Bugs fixed (reproduced in a real browser first)
- Every launcher (DPP, Practice, Ranker, AI, Notebook, Mastery, PDF) opened Biology 90Q. Each now opens its own set; stale sets can no longer leak in.
- Analysis recorded every non-PDF test as "Biology Test N". Now recorded under its real source.
- AI engine crash on A–D answers (Test180 / "0 valid questions"); missing addRankBoosterQuestion; Start Today's Action dead button; Retry/learning-loop always 0; mistakes saved without topic; PDF question split across a page dropped; "Questions available: 0"; options with blanks shifted the answer key.
- pool-seed no longer force-reloads the page while you are using it.
- pages.yml no longer holds the one-off cleanup job (it only runs the health check now).

## Cleanup
Removed: 134 flattened duplicate files, the 255-file .cloudflare-dist copy (Cloudflare now serves the repo root, see .assetsignore), 7 unlinked/dev pages, rf-nav-v1.js, rankforge-ui-security-v1.css, junk snapshots.

## APK: install once, update from GitHub
- capacitor.config.json loads the live Pages site; commit → Pages deploys → app updated. Full web tree bundled as an offline fallback.
- Same signing key every build (tools/android-debug.keystore, debug-grade) + rising versionCode so rebuilds install as updates.
- Releases ▸ apk-latest ▸ RankForge.apk. Rebuild only for native changes or via Actions ▸ RankForge Android APK ▸ Run workflow.
- In the APK "Download report" cannot save a file; use "Share summary".

## You must still do
1. Free AI: paste a Gemini key in Owner Hub ▸ Free AI (fastest), or deploy the Worker (token from the "Edit Cloudflare Workers" template).
2. Check the Android build and first launch on your phone (not testable here).

## Known limits
- 30 of 180 Test180 questions have formulas the PDF reader cannot read; they are flagged and excluded from practice. Fixing needs page-image crops (not built).
- Biology topic labels are inferred from keywords (~88%); the bank has no chapter field.
- Physics/Chemistry verified pools are small (29 / 30 usable from Test 180); AI top-up and PDF import add more.
- Owner mode is a client-side flag, not real security. The debug signing key is public in the repo.
- Only wrongly answered questions are saved as mistakes.
