# RankForge Fix-Pack v1 — what changed and why

## Root causes found
1. **PDF/AI/DPP/Ranker tests opened Biology 90Q** — `cbt.html` had a startup guard that ALWAYS overwrote the active source with Biology, and only understood `?source=pdf`. Five other entry points (`cbt.html` plain, `?source=rankers-test-series`, `?source=rank-booster`, adaptive DPP, AI generator, ranker practice) all fell into Biology mode.
2. **"HTML-looking" questions** — `cbt.html` used `textContent`; lists, tables, sub/sup were flat text. Result screen injected raw question text into `innerHTML` (broken markup + XSS risk).
3. **AI not connected** — `RankForgeAI.generateQuestions` never existed; three pages used three different endpoint keys; default `/api/ai/generate` is relative, which cannot exist on GitHub Pages. Worker ignored `focus`.
4. **"Unknown" topics in DPP** — four engines defaulted to "Unknown"; PDF/AI questions carry no topic.
5. **PCB NICHOD LIVE** — debug overlay left on in production (rankers-test-series, legacy pdf page).
6. **Deploy drift** — `wrangler.jsonc` serves `.cloudflare-dist`, a stale copy of the root.
7. **Timer** — 180 questions got 60 min.

## Changes
- `rf-fixpack-v1.js` (new, loaded on 36 pages): hand-off chooser, rich text, AI provider, topic inference, debug-panel hider.
- `cbt.html`: hand-off aware (all questions, no 90 cap), rich rendering, 200-min timer for 180Q, dynamic titles, one-shot hand-off consumption.
- DPP/mentor/mistake engines: infer real topic instead of "Unknown".
- `notebook-studio.html` + `rankforge-notebook-v1.js` (new): NotebookLM-style, source-grounded.
- `owner-hub.html` (new): System Doctor, one AI endpoint, repairs, cache reset, module links.
- Worker: `context` grounding + `sourceQuote`; engine no longer overwrites `RankForgeAI`.
- `sw.js` cache bumped. `tools/sync-dist.sh` added.

## You must do (cannot be done from code)
1. Deploy the Worker (GitHub Action "Deploy RankForge AI Worker", needs only CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID). It uses the free Workers AI binding — **no OpenAI key**. Set `ALLOWED_ORIGIN` in `rankforge-ai-worker/wrangler.jsonc` to your exact site origin.
2. Open Owner Hub → paste the Worker URL → Save & test.
3. Free model is `@cf/meta/llama-3.1-8b-instruct` (set in `AI_MODEL`); confirm it is available on your account and the free daily allowance suits you. Quality is below OpenAI; notebook questions are checked against your source text.
4. If you use Cloudflare for the site: run `tools/sync-dist.sh` before `wrangler deploy`.
