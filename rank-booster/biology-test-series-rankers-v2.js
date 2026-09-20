(function () {
  "use strict";

  const VERSION = "RANKFORGE_BIOLOGY_2700_RANKERS_V2";
  const BANK_KEY = "RANKFORGE_BIOLOGY_2700_BANK_V2";
  const META_KEY = "RANKFORGE_BIOLOGY_2700_META_V2";

  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const TEST_START_PAGES = [
    8,18,28,38,47,57,67,77,87,97,
    106,116,126,136,146,156,166,176,185,195,
    204,214,223,232,242,252,262,272,281,291
  ];

  function el(id) {
    return document.getElementById(id);
  }

  function say(msg) {
    const x = el("rfBio2700Status");
    if (x) x.textContent = String(msg);
  }

  function loadPDFJS() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PDFJS;
      s.onload = function () {
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
        } catch (_) {}
        resolve(window.pdfjsLib);
      };
      s.onerror = function () {
        reject(new Error("PDF.js could not be loaded."));
      };
      document.head.appendChild(s);
    });
  }

  /*
   * Rebuild PDF.js text into lines using Y coordinates.
   * This is important because simply joining all text items can destroy
   * question boundaries.
   */
  async function pageText(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const tc = await page.getTextContent();

    const rows = [];

    for (const item of tc.items || []) {
      const text = String(item.str || "");
      if (!text.trim()) continue;

      const tr = item.transform || [];
      const x = Number(tr[4] || 0);
      const y = Number(tr[5] || 0);

      let row = rows.find(r => Math.abs(r.y - y) < 3);

      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }

      row.items.push({ x, text });
    }

    rows.sort((a,b) => b.y - a.y);

    return rows.map(row => {
      row.items.sort((a,b) => a.x - b.x);
      return row.items.map(x => x.text).join(" ").trim();
    }).filter(Boolean).join("\n");
  }

  function cleanText(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .trim();
  }

  /*
   * Locate exactly Q1..Q90 in order.
   * We never globally dedupe Q1..Q90, because every test legitimately
   * contains its own Q1..Q90.
   */
  function splitQuestions90(text) {
    const starts = [];
    const re = /(?:^|\n)\s*(\d{1,2})\s*\.\s+/g;
    let m;

    while ((m = re.exec(text))) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 90) {
        starts.push({
          number: n,
          start: m.index + m[0].length - m[0].trimStart().length
        });
      }
    }

    const selected = [];
    let cursor = 0;

    for (let q = 1; q <= 90; q++) {
      let found = -1;

      for (let i = cursor; i < starts.length; i++) {
        if (starts[i].number === q) {
          found = i;
          break;
        }
      }

      if (found < 0) return null;

      selected.push(starts[found]);
      cursor = found + 1;
    }

    const result = [];

    for (let i = 0; i < 90; i++) {
      const start = selected[i].start;
      const end = i === 89 ? text.length : selected[i + 1].start;

      let raw = text.slice(start, end).trim();

      raw = raw.replace(/^\d{1,2}\s*\.\s*/, "").trim();

      result.push(raw);
    }

    return result.length === 90 ? result : null;
  }

  /*
   * Take the LAST four option markers.
   * This matters for statement-based questions containing a,b,c,d
   * statements before the actual answer options.
   */
  function extractOptions(raw) {
    const hits = [];
    const re = /(?:^|\n)\s*\(?([a-dA-D])\)?\s*[\.\:\)]\s+/g;
    let m;

    while ((m = re.exec(raw))) {
      hits.push({
        letter: m[1].toLowerCase(),
        pos: m.index + m[0].length
      });
    }

    if (hits.length < 4) {
      const inline = [];
      const r2 = /\(([a-dA-D])\)\s*/g;
      let z;
      while ((z = r2.exec(raw))) {
        inline.push({
          letter: z[1].toLowerCase(),
          pos: z.index + z[0].length
        });
      }
      if (inline.length >= 4) {
        hits.length = 0;
        inline.forEach(x => hits.push(x));
      }
    }

    if (hits.length < 4) return [];

    const last4 = hits.slice(-4);
    const out = [];

    for (let i = 0; i < last4.length; i++) {
      const start = last4[i].pos;
      const end = i === 3 ? raw.length : last4[i + 1].pos;

      const value = cleanText(raw.slice(start, end))
        .replace(/\s*\n\s*/g, " ")
        .trim();

      if (value) out.push(value);
    }

    return out;
  }

  function makeQuestion(raw, testNumber, questionNumber) {
    const text = cleanText(raw);
    const options = extractOptions(raw);

    return {
      id: "NEET-BIO-TS-" + testNumber + "-Q" + questionNumber,
      sourceId: "NEET-BIO-TEST-" + testNumber,
      sourceQuestionNumber: questionNumber,
      testNumber: testNumber,
      subject: "Biology",
      chapter: "NEET Biology Test Series — Test " + testNumber,
      topic: "Test " + testNumber,

      /* Original source wording; no AI rewriting. */
      text: text,
      question: text,
      originalText: text,
      originalSource: true,
      source: "NEET Biology Test Series.pdf",

      options: options,

      marks: 4,
      negativeMarks: 1,

      correctAnswer: null,
      answerKeyRaw: null,
      answerReviewRequired: false
    };
  }

  /*
   * Answer-key parser.
   * The supplied PDF has:
   * ANSWER KEY TEST - N
   * Qus. ...
   * Ans. ...
   *
   * We scope the key to each TEST section, so Q1 of Test 2 never
   * overwrites Q1 of Test 1.
   */
  function parseAnswerKeys(text) {
    const result = {};
    const normalized = text.replace(/\r/g, "");

    const heads = [];
    const headRe = /ANSWER\s+KEY\s+TEST\s*[-–—]?\s*(\d{1,2})/gi;
    let h;

    while ((h = headRe.exec(normalized))) {
      heads.push({
        test: Number(h[1]),
        start: h.index
      });
    }

    for (let i = 0; i < heads.length; i++) {
      const current = heads[i];
      const end = i + 1 < heads.length
        ? heads[i + 1].start
        : normalized.length;

      const section = normalized.slice(current.start, end);
      const map = {};

      const qRe = /Qus\.\s*([0-9\s]+)\s+Ans\.\s*([a-dA-D](?:\/[a-dA-D])?(?:\s+[a-dA-D](?:\/[a-dA-D])?)*)/gi;
      let q;

      while ((q = qRe.exec(section))) {
        const nums = q[1].trim().split(/\s+/).map(Number);
        const answers = q[2].trim().split(/\s+/);

        if (!nums.length) continue;

        for (let j = 0; j < nums.length; j++) {
          if (!Number.isFinite(nums[j])) continue;

          const rawAns = String(answers[j] || "").toLowerCase();

          if (!rawAns) continue;

          map[String(nums[j])] = rawAns;
        }
      }

      result[String(current.test)] = map;
    }

    return result;
  }

  function applyAnswerKeys(bank, keys) {
    let answered = 0;
    let review = 0;

    for (let t = 1; t <= 30; t++) {
      const arr = bank[String(t)] || [];
      const key = keys[String(t)] || {};

      for (const q of arr) {
        const raw = key[String(q.sourceQuestionNumber)];

        if (!raw) continue;

        q.answerKeyRaw = raw;

        if (/^[a-d]$/.test(raw)) {
          q.correctAnswer = raw;
          answered++;
        } else {
          /*
           * Test 2 contains an explicit "a/c" source entry.
           * Do NOT silently choose one.
           */
          q.correctAnswer = null;
          q.answerReviewRequired = true;
          review++;
        }
      }
    }

    return { answered, review };
  }

  async function importPDF(file) {
    if (!file) throw new Error("Please select the Biology Test Series PDF.");

    say("Loading PDF engine…");

    const pdfjs = await loadPDFJS();

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;

    if (pdf.numPages !== 310) {
      throw new Error(
        "This importer expects the verified 310-page NEET Biology Test Series PDF. " +
        "Detected " + pdf.numPages + " pages."
      );
    }

    const pages = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      if (p % 5 === 0 || p === 1 || p === 310) {
        say("Reading PDF pages: " + p + " / " + pdf.numPages);
      }

      pages.push(await pageText(pdf, p));
    }

    const bank = {};

    for (let test = 1; test <= 30; test++) {
      const startPage = TEST_START_PAGES[test - 1];
      const endPage = test < 30
        ? TEST_START_PAGES[test] - 1
        : 300;

      const combined = pages
        .slice(startPage - 1, endPage)
        .join("\n");

      const questions = splitQuestions90(combined);

      if (!questions || questions.length !== 90) {
        throw new Error(
          "Test " + test +
          " parsed " + (questions ? questions.length : 0) +
          " questions instead of 90. " +
          "Nothing was activated."
        );
      }

      const arr = questions.map((raw, i) =>
        makeQuestion(raw, test, i + 1)
      );

      const invalid = arr.filter(q =>
        !q.text ||
        q.options.length < 2
      );

      if (invalid.length) {
        throw new Error(
          "Test " + test +
          " contains " + invalid.length +
          " question records with insufficient options. " +
          "Nothing was activated."
        );
      }

      bank[String(test)] = arr;
    }

    const all = Object.values(bank).flat();

    if (
      Object.keys(bank).length !== 30 ||
      all.length !== 2700
    ) {
      throw new Error(
        "FINAL VALIDATION FAILED: " +
        all.length +
        " questions. Expected exactly 2700."
      );
    }

    say("Parsing the 30-test answer key…");

    const answerText = pages
      .slice(300, 310)
      .join("\n");

    const keys = parseAnswerKeys(answerText);

    const keyResult = applyAnswerKeys(bank, keys);

    let keyCount = 0;

    for (let t = 1; t <= 30; t++) {
      const key = keys[String(t)] || {};
      keyCount += Object.keys(key).length;
    }

    if (keyCount !== 2700) {
      throw new Error(
        "Answer-key validation failed: " +
        keyCount +
        " entries detected; expected 2700. " +
        "Nothing was activated."
      );
    }

    /*
     * Only after ALL strict validation passes do we write the bank.
     */
    localStorage.setItem(BANK_KEY, JSON.stringify(bank));

    localStorage.setItem(META_KEY, JSON.stringify({
      version: VERSION,
      sourceFile: file.name,
      pages: 310,
      tests: 30,
      questionsPerTest: 90,
      totalQuestions: 2700,
      answerKeyEntries: keyCount,
      directlyScoredAnswers: keyResult.answered,
      answerReviewEntries: keyResult.review,
      importedAt: new Date().toISOString(),
      originalSourcePreserved: true
    }));

    return {
      bank,
      keyCount,
      answered: keyResult.answered,
      review: keyResult.review
    };
  }

  function startTest(testNumber) {
    const bank = JSON.parse(
      localStorage.getItem(BANK_KEY) || "{}"
    );

    const questions = bank[String(testNumber)];

    if (!Array.isArray(questions) || questions.length !== 90) {
      alert(
        "Biology Test " +
        testNumber +
        " is not a validated 90-question test."
      );
      return;
    }

    /*
     * Existing RankForge/CBT-compatible active-question handoff.
     */
    const payload = JSON.stringify(questions);

    localStorage.setItem("CBT_ACTIVE_QUESTIONS", payload);
    localStorage.setItem("CBT_ACTIVE_TEST_TITLE",
      "NEET Biology Test " + testNumber);
    localStorage.setItem("CBT_ACTIVE_SOURCE",
      "rankers-biology-2700");
    localStorage.setItem("pdfCbtQuestions", payload);
    localStorage.setItem("pdfQuestions", payload);

    window.location.href =
      "./cbt.html?source=rankers-biology&test=" + testNumber;
  }

  function renderTests() {
    const holder = el("rfBio2700Tests");
    if (!holder) return;

    holder.innerHTML = "";

    for (let i = 1; i <= 30; i++) {
      const b = document.createElement("button");

      b.type = "button";
      b.textContent = "Biology Test " + i + " • 90 Q";
      b.style.cssText =
        "padding:10px 12px;border-radius:10px;" +
        "border:1px solid #475569;background:#1e293b;" +
        "color:#fff;cursor:pointer;font-weight:600";

      b.onclick = function () {
        startTest(i);
      };

      holder.appendChild(b);
    }
  }

  function installUI() {
    if (document.getElementById("rankforgeBiology2700")) {
      return;
    }

    const section = document.createElement("section");
    section.id = "rankforgeBiology2700";

    section.style.cssText =
      "margin:20px 0;padding:18px;border:1px solid #334155;" +
      "border-radius:16px;background:#0f172a;color:#e5e7eb";

    section.innerHTML =
      '<h2 style="margin:0 0 8px">🧬 Biology Test Series — 30 Tests</h2>' +
      '<p style="margin:0 0 12px;color:#94a3b8">' +
      'Original PDF → 30 × 90 questions → existing CBT. ' +
      'The bank activates only after exact 2700-question validation.' +
      '</p>' +
      '<input id="rfBio2700Pdf" type="file" accept=".pdf,application/pdf">' +
      '<button id="rfBio2700Import" type="button" ' +
      'style="margin-left:8px;padding:9px 12px;border-radius:9px">' +
      'Import Biology 2700</button>' +
      '<div id="rfBio2700Status" ' +
      'style="margin-top:12px;white-space:pre-wrap"></div>' +
      '<div id="rfBio2700Tests" ' +
      'style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:12px"></div>';

    const anchor =
      document.querySelector(".wrap") ||
      document.querySelector("main") ||
      document.querySelector(".container") ||
      document.body;

    const hero = anchor && anchor.querySelector(".hero");

    if (hero) {
      hero.insertAdjacentElement("afterend", section);
    } else {
      anchor.appendChild(section);
    }

    section.style.setProperty("display", "block", "important");
    section.style.setProperty("visibility", "visible", "important");
    section.style.setProperty("opacity", "1", "important");

    el("rfBio2700Import").onclick = async function () {
      const input = el("rfBio2700Pdf");
      const file = input && input.files && input.files[0];

      try {
        if (!file) {
          say("Select the NEET Biology Test Series PDF first.");
          return;
        }

        say("Starting strict 30 × 90 import…");

        const result = await importPDF(file);

        renderTests();

        say(
          "IMPORT SUCCESS\n" +
          "30 tests × 90 questions = 2700\n" +
          "Answer-key entries = " + result.keyCount + "\n" +
          "Directly scored answers = " + result.answered + "\n" +
          "Source-ambiguous entries = " + result.review + "\n" +
          "Original question wording preserved.\n" +
          "Bank activated."
        );
      } catch (err) {
        localStorage.removeItem(BANK_KEY);
        localStorage.removeItem(META_KEY);

        const box = el("rfBio2700Tests");
        if (box) box.innerHTML = "";

        say(
          "IMPORT STOPPED — BANK NOT ACTIVATED\n\n" +
          (err && err.message ? err.message : String(err))
        );
      }
    };
  }

  function boot() {
    installUI();

    try {
      const meta = JSON.parse(
        localStorage.getItem(META_KEY) || "null"
      );

      const bank = JSON.parse(
        localStorage.getItem(BANK_KEY) || "null"
      );

      if (
        meta &&
        meta.totalQuestions === 2700 &&
        bank &&
        Object.keys(bank).length === 30
      ) {
        renderTests();

        say(
          "Validated Biology 2700 bank already loaded.\n" +
          "30 tests × 90 questions."
        );
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.RankForgeBiology2700RankersV2 = {
    importPDF: importPDF,
    startTest: startTest
  };
})();
