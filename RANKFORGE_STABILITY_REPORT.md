# RankForge stability and Forge verification report

Run on 2026-10-15 under a GitHub-Pages-style base path (/ai-cbt-analyzer-production/), mobile viewport 390x844, Chromium.

**Result: 34 of 34 checks passed.**

| Area | Check | Result |
|---|---|---|
| Navigation | tab "learn" opens | PASS |
| Navigation | tab "practice" opens | PASS |
| Navigation | tab "tests" opens | PASS |
| Navigation | tab "progress" opens | PASS |
| Navigation | tab "home" opens | PASS |
| Navigation | browser Back returns to previous tab | PASS |
| Navigation | Back again | PASS |
| Navigation | Forward | PASS |
| Navigation | reload keeps the open tab | PASS |
| Navigation | unknown link falls back to Home | PASS |
| Navigation | tile opens Question Bank with the shared bar | PASS |
| Navigation | shared Back returns to Home screen | PASS |
| Navigation | Back with no history goes Home (never a dead end) | PASS |
| Navigation | shared bar Practice link opens Practice tab | PASS |
| Stability | every non-exam page has a way home (41 pages) | PASS |
| Stability | no JS errors on any page (owner-only gate excluded) | PASS |
| Forge | 3 typed sources added and labelled | PASS |
| Forge | several files at once: 2 added, unsupported one explained | PASS |
| Forge | PDF upload is read with the bundled PDF reader | PASS |
| Forge | coverage grid shows every syllabus line and marks never-asked ones (5 lines, 3 never asked) | PASS |
| Forge | never-asked topics are ranked first | PASS |
| Forge | tapping a topic opens Questions with the focus filled | PASS |
| Forge | AI request carries the chosen difficulty, topic and source context | PASS |
| Forge | 10 grounded questions shown (mode ai-grounded) | PASS |
| Forge | Save to bank writes importedQuestions for DPP and analysis | PASS |
| Connect | questions open in your CBT (same text as the Forge) | PASS |
| Connect | CBT shows all 10 questions | PASS |
| Connect | test can be submitted and a result is shown | PASS |
| Connect | result is saved for history and analysis (new storage keys: cbtHistory,cbtMasteryV2,cbtMistakes,rankBoosterAttemptHistory,rankforg) | PASS |
| Connect | history.html opens after the test | PASS |
| Connect | analysis.html opens after the test | PASS |
| Forge | no JS errors during the whole Forge flow | PASS |
| Forge | works without any AI server (offline generator) | PASS |
| Safety | canonical Biology bank unchanged (7196 questions, 3 copies, same hashes) | PASS |
