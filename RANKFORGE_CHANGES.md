# RankForge update: stable navigation + Question Forge in Nexus

## What you get
1. **Stable navigation.** Every page now has the same top bar: Back, Home, Learn, Practice, Tests, Progress, Nexus. Back never leads to a dead end (if there is no earlier page, it goes Home). Exam screens (cbt.html, attempt.html, test-loader.html, biology CBT pages) deliberately have no bar, so a test cannot be left by accident.
2. **Question Forge inside Nexus (notebook-studio.html).**
   - Tag each source: NCERT, PYQ, Own module, Test series, NTA syllabus.
   - Upload several PDFs or text files at once (PDF text is read with your bundled PDF reader).
   - Choose difficulty: NEET mix, Easy, Medium, Hard, Rank Booster. It is sent to your AI server with the topic and your source text.
   - New **Predict** tab: compares your NTA syllabus with your PYQs, shows filled/dashed coverage boxes and a "Study next" list (rarest first). Tap a topic to generate questions on it.
   - Generate, then **Practice these in CBT**. The test opens in your own CBT, and the result is saved for history and analysis.
3. The service worker cache name was bumped so phones pick up the update.
4. **Home bottom bar fixed.** The bar held six items (Nexus plus five tabs) in a five-column layout, so the Progress tab (your dashboard) wrapped onto a second row below the screen. All six now sit in one row: Home, Learn, Practice, Tests, Progress, Nexus. This is the only change in `index.html`.

## Install (about 2 minutes)
1. Unzip `rankforge-stable-nav-forge.zip`.
2. On GitHub open your repo, choose **Add file > Upload files**, drag in everything from the unzipped folder (keep the folders), then **Commit changes**.
   Or copy the files over your local repo and run `git add -A && git commit -m "Stable navigation + Forge" && git push`.
3. Wait about a minute, open the site and refresh once.
4. If you also deploy to Cloudflare, run `tools/sync-dist.sh` before `wrangler deploy` (the Cloudflare copy is a separate folder).

## If your app shows "This site can't be reached - 127.0.0.1 refused to connect"
`127.0.0.1` means "this same device". An address that starts with it only works while a program on that device is serving the app. Nothing in your app sends you there, so the app was opened from a saved local address: a bookmark, a home-screen icon or installed app made while testing locally, or a typed address.
1. Open the live app: https://adityakr221503-a11y.github.io/ai-cbt-analyzer-production/
2. Delete the old bookmark and the old home-screen icon / installed app.
3. Install again from the live address (Chrome menu > Add to Home screen or Install app).
Also fixed: the optional "local AI" helper (rankforge-local-provider.js, rankers-test-series.html) no longer calls 127.0.0.1 from the live site. It was pointed at a path the local server does not have, so every local AI request failed or timed out. It now stays off unless you run the app on your own computer or turn it on, and it says so plainly.

## Not touched
The 7,196-question Biology bank (all 3 copies verified byte-identical), the CBT engine, the Worker, and all exam screens.

## Known limits
- Real AI generation needs your Worker URL saved in Owner Hub. Without it, the offline generator is used (those questions are marked "review before relying").
- The offline generator ignores difficulty.
- Coverage and "Study next" are keyword matches on your own text: an estimate, not a guarantee. A syllabus source should contain one topic per line, because every line counts as a topic.
- Tested in Chromium at phone size with a stand-in AI server. Not tested on a real iPhone or Android device, or against your real Worker.
- pdf.html and rankforge-source-importer.html load scripts from the internet (tesseract, jszip); they could not be exercised offline.
