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

## Install (about 2 minutes)
1. Unzip `rankforge-stable-nav-forge.zip`.
2. On GitHub open your repo, choose **Add file > Upload files**, drag in everything from the unzipped folder (keep the folders), then **Commit changes**.
   Or copy the files over your local repo and run `git add -A && git commit -m "Stable navigation + Forge" && git push`.
3. Wait about a minute, open the site and refresh once.
4. If you also deploy to Cloudflare, run `tools/sync-dist.sh` before `wrangler deploy` (the Cloudflare copy is a separate folder).

## Not touched
The 7,196-question Biology bank (all 3 copies verified byte-identical), the CBT engine, the Worker, and all exam screens.

## Known limits
- Real AI generation needs your Worker URL saved in Owner Hub. Without it, the offline generator is used (those questions are marked "review before relying").
- The offline generator ignores difficulty.
- Coverage and "Study next" are keyword matches on your own text: an estimate, not a guarantee. A syllabus source should contain one topic per line, because every line counts as a topic.
- Tested in Chromium at phone size with a stand-in AI server. Not tested on a real iPhone or Android device, or against your real Worker.
- pdf.html and rankforge-source-importer.html load scripts from the internet (tesseract, jszip); they could not be exercised offline.
