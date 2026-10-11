# RankForge AI - what was fixed (17 files)

Tested in a real headless browser: before = 13 of 37 pages crashed on load, after = 0
(owner-source.html is blocked on purpose, it needs owner login).
Also tested: start test -> answer -> mark review -> submit -> results -> mistakes saved.

## Crashes fixed
- index.html, rankforge-app.html: leftover broken code `);` stopped the whole script.
- rankers-test-series.html: half-deleted NICHOD widget (restored from your backup),
  missing helper script added, stats JSON bug fixed.
- ranker-common-engine.js: 17 functions were missing (saveTestSession, getBank,
  getMistakes, getWeakTopics ...). Restored from your 2026-09-05 backup. Fixes
  command-center, ranker-command-center, orbit-test-analysis.
- orbit-engine.js: second version overwrote the first, so syncRecovery vanished.
- mistake.html: updateCounts() was never defined.
- rank-booster/ai-new-question-module-v1.js: a second export wiped getStaged/approve.
- src/core/question.js: two copies of createQuestion pasted together.
- src/core/index.js + dppEngine.js + attempt.js + test-loader.html: wrong file paths
  and missing exports (retry.html could not load).
- ai-test-generator.html: removed link to a file that does not exist.
- rankforge-universal-source-fabric-v1.js: JSON import failed for pretty-printed files.

## Logic bugs fixed
- Home screen showed 0 mistakes while Mistake Book showed 5. Home now reads the same data.
- src/core/practice/practiceEngine.js: practice results never reached the DPP engine,
  so a mistake could never advance to mastered. Fixed + added getNextPracticeType.
- sw.js: cache version bumped so phones drop old files.

## NOT fixed (needs your decision)
- Some questions in the bank are broken: options are inside the question text and
  publisher header text is mixed in (from PDF import). They show as "Unanswered".
- Delete the junk file named `tore --staged cbt.html` from the repo.
- ~400 old backup files are published on your site (.cbt-backups, cbt.before-*.html).
