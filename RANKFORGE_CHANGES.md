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
5. **Test 180 import repaired.** The "IMPORT TEST 180" button called a function that no longer exists, so all 180 questions were rejected. It now imports the 150 text questions, reports the result in plain words, creates no duplicates on a second tap, and retries once if the file is slow to load. The 30 questions whose options are pictures are skipped, because that bank holds text questions only.
6. **PDF reading works without the internet.** Test-series PDF import and the owner PDF adapter now use the PDF reader bundled in `vendor/` first; the internet copy is only a fallback. Tested by parsing a real PDF with the internet blocked.
7. **Copy buttons no longer fail silently.** "Copy Specification" and the Study Vault copy now cope with a blocked clipboard and say what happened (new file `rf-copy-v1.js`).

## Get the app on your phone (pick one)
**Option A: install from the live link (fastest, works on any phone)**
1. Open https://adityakr221503-a11y.github.io/ai-cbt-analyzer-production/ in Chrome. Wait for it to load once.
2. Delete any old RankForge icon first. Then Chrome menu (three dots) > **Install app** (or Add to Home screen).
**Option B: Android APK (an installable file)**
1. After you upload these files, GitHub builds the APK by itself (about 8 to 12 minutes). To start it by hand: your repo > **Actions** > **RankForge Android APK** > **Run workflow**.
2. When the run shows a green tick, open it and scroll to **Artifacts**. Tap **RankForge-v1.0.0-debug** to download a zip.
3. Unzip it, tap **app-debug.apk**, and allow "Install unknown apps" for your browser or Files app when Android asks.
4. If the run shows a red cross, open the failing step and send me its last 30 lines.
5. Android APK fix in this update: the old build copied only top-level files, so the APK was missing the owner-imports, rank-booster, nichod and vendor folders and the question images. Test Series, PDF reading and the owner guard would not have worked inside the app. The build now bundles them and fails early if any is missing.

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
- The APK itself could not be built here (no Android SDK). I verified the web files that go inside it; GitHub Actions does the real build.
- The `.github` folder is hidden on some phones and computers. If you cannot upload it, open `.github/workflows/rankforge-android.yml` on GitHub, tap the pencil (edit), paste the contents of the separate `rankforge-android.yml` file, and commit.
- Coverage and "Study next" are keyword matches on your own text: an estimate, not a guarantee. A syllabus source should contain one topic per line, because every line counts as a topic.
- Tested in Chromium at phone size with a stand-in AI server. Not tested on a real iPhone or Android device, or against your real Worker.
- pdf.html and rankforge-source-importer.html load scripts from the internet (tesseract, jszip); they could not be exercised offline.
