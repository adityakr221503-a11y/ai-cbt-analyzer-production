/*
 * RankForge PDF -> CBT V8 FINAL ENGINE
 * Single authoritative importer.
 * Goals:
 *  - never reuse an older PDF
 *  - prefer readable PDF text, but switch to OCR when the text layer is garbled
 *  - ignore instructions/marking schemes/headers
 *  - English-only output from bilingual PDFs
 *  - reconstruct 4-option MCQs even when question/options wrap across lines
 *  - preserve source page for later visual rendering
 */
(function () {
  "use strict";

  const KEYS = {
    pool: "pdfCbtQuestions",
    meta: "pdfCbtImportMetaV8",
    active: "CBT_ACTIVE_QUESTIONS",
    activeTest: "CBT_ACTIVE_TEST",
    activeSource: "CBT_ACTIVE_SOURCE",
    activeId: "CBT_ACTIVE_TEST_ID"
  };

  const $ = (id) => document.getElementById(id);
  const clean = (s) => String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  const norm = (s) => clean(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();

  function setStatus(text) {
    const el = $("status");
    if (el) el.textContent = text;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[c]));
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn("PDF storage failed", e); return false; }
  }

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }

  function answerLetter(v) {
    const s = clean(v).toUpperCase().replace(/[()[\].:]/g, "");
    if (/^[ABCD]$/.test(s)) return s;
    if (/^[1-4]$/.test(s)) return "ABCD"[Number(s) - 1];
    return "";
  }

  function optionStart(line) {
    const m = clean(line).match(/^\s*(?:\(([A-Da-d1-4])\)|\[([A-Da-d1-4])\]|([A-Da-d1-4])\s*[.):-])\s*(.*)$/);
    if (!m) return null;
    const letter = answerLetter(m[1] || m[2] || m[3]);
    const text = clean(m[4]);
    return letter && text ? { letter, text } : null;
  }

  function questionStart(line) {
    const s = clean(line);
    if (!s) return null;
    if (/^(?:answer|ans(?:wer)?|correct\s*answer|marking\s*scheme|instructions?|general\s*instructions?|important\s*instructions?)\b/i.test(s)) return null;

    let m = s.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)\-:]\s*(.*)$/i);
    if (!m) m = s.match(/^Q(?:uestion)?\s*(\d{1,3})\s+(.*)$/i);
    if (!m) return null;

    const number = Number(m[1]);
    const rest = clean(m[2]);
    if (!Number.isFinite(number) || number < 1 || number > 999) return null;
    if (!rest || /^[A-Da-d1-4]$/.test(rest)) return null;

    // Instructions frequently start with numbered lines. Reject obvious instruction language.
    if (/^(?:the\s+test|this\s+test|each\s+question|for\s+each|candidate|duration|maximum\s+marks|negative\s+mark|marks?\s+for|general\s+instructions|choose\s+the|read\s+the\s+following\s+instructions)/i.test(rest)) return null;
    return { number, text: rest };
  }

  function repairText(s) {
    return String(s ?? "")
      .replace(/[\u200B-\u200F\uFEFF]/g, "")
      .replace(/\u00AD/g, "")
      .replace(/([A-Za-z])\s*-\s+([a-z])/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();
  }

  const commonWords = new Set((
    "the of and to in is for a on with as by from that are this be or an it " +
    "which one two three four following each when will can not has have into " +
    "than then if at was were their its these those question correct answer " +
    "force mass velocity acceleration energy current charge pressure volume cell " +
    "plant animal human chemical reaction compound solution temperature distance " +
    "time speed moving body object particle"
  ).split(/\s+/));

  function readabilityScore(text) {
    const s = clean(text);
    if (!s) return 0;
    const words = s.toLowerCase().match(/[a-z]{2,}/g) || [];
    if (!words.length) return 0;
    const common = words.filter(w => commonWords.has(w)).length;
    const weird = (s.match(/[\[\]{}<>@#$%^*_~`|\\]/g) || []).length;
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    const digits = (s.match(/[0-9]/g) || []).length;
    const tokenGood = words.filter(w => /^[a-z]{2,20}$/.test(w)).length / words.length;
    const commonRate = common / Math.max(1, words.length);
    const letterRate = letters / Math.max(1, s.replace(/\s/g, "").length);
    const weirdRate = weird / Math.max(1, s.length);
    return (commonRate * 0.55) + (tokenGood * 0.25) + (letterRate * 0.20) - (weirdRate * 0.35) + (digits > 0 ? 0.02 : 0);
  }

  function pageTextQuality(pages) {
    const text = (pages || []).map(p => (p.lines || []).join(" ")).join(" ");
    const qStarts = (text.match(/(?:^|\s)(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)\-:]/gi) || []).length;
    const optStarts = (text.match(/(?:^|\s)[(\[]?[A-D1-4][)\].:-]\s/gi) || []).length;
    return { score: readabilityScore(text), qStarts, optStarts, chars: text.length };
  }

  function groupPdfItems(items) {
    const rows = [];
    for (const item of items || []) {
      const text = String(item.str ?? "").trim();
      if (!text) continue;
      const tr = item.transform || [];
      const x = Number(tr[4] || 0);
      const y = Number(tr[5] || 0);
      const fs = Math.abs(Number(tr[0] || tr[3] || 10)) || 10;
      let row = rows.find(r => Math.abs(r.y - y) <= Math.max(2.5, fs * 0.30));
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, text, fs });
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => {
      r.items.sort((a, b) => a.x - b.x);
      let out = "";
      let prevX = null;
      let prevFs = 10;
      for (const it of r.items) {
        if (!out) { out = it.text; prevX = it.x; prevFs = it.fs; continue; }
        const gap = it.x - prevX;
        const addSpace = !(gap < Math.max(2, prevFs * 0.75) && /[A-Za-z0-9)]$/.test(out) && /^[A-Za-z0-9(]/.test(it.text));
        out += addSpace ? " " : "";
        out += it.text;
        prevX = it.x;
        prevFs = it.fs;
      }
      return repairText(out);
    });
  }

  async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js is not loaded.");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      pages.push({ page: p, lines: groupPdfItems(content.items) });
    }
    return pages;
  }

  async function getTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("OCR engine could not be loaded. Connect to the internet for OCR fallback."));
      document.head.appendChild(s);
    });
    return window.Tesseract;
  }

  async function ocrPages(file) {
    const T = await getTesseract();
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];
    let worker = null;

    try {
      if (T.createWorker) worker = await T.createWorker("eng");
      for (let p = 1; p <= pdf.numPages; p++) {
        setStatus(`🖼️ OCR reading page ${p} of ${pdf.numPages}…`);
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.35 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        await page.render({ canvasContext: ctx, viewport }).promise;

        let result;
        if (worker) result = await worker.recognize(canvas);
        else result = await T.recognize(canvas, "eng");
        pages.push({ page: p, lines: String(result?.data?.text || "").split(/\r?\n/) });
        canvas.width = 1; canvas.height = 1;
      }
    } finally {
      if (worker && worker.terminate) { try { await worker.terminate(); } catch (_) {} }
    }
    return pages;
  }

  function isInstruction(text) {
    const s = clean(text).toLowerCase();
    if (!s) return true;
    return /^(?:general\s+instructions?|instructions?|important\s+instructions?|the\s+test\s+is|this\s+test\s+is|each\s+question|for\s+each\s+correct|for\s+each\s+incorrect|negative\s+marking|maximum\s+marks?|duration|time\s+allowed|read\s+the\s+following|choose\s+the\s+correct|do\s+not\s+write|rough\s+work|use\s+of\s+calculator|candidate\s+shall|candidate\s+will|question\s+paper|test\s+booklet|booklet\s+contains)/i.test(s);
  }

  function parsePages(pages) {
    const groups = [];
    let current = null;

    for (const pg of pages || []) {
      for (const raw of pg.lines || []) {
        const line = clean(raw);
        if (!line) continue;
        const q = questionStart(line);
        if (q) {
          if (current) groups.push(current);
          current = { number: q.number, lines: [], page: pg.page };
          if (q.text) current.lines.push(q.text);
          continue;
        }
        if (current) current.lines.push(line);
      }
    }
    if (current) groups.push(current);

    return groups.map(g => buildQuestion(g)).filter(Boolean);
  }

  function buildQuestion(group) {
    let stem = [];
    const options = [];
    let current = null;

    for (const raw of group.lines) {
      const line = clean(raw);
      if (!line || isInstruction(line)) continue;

      const os = optionStart(line);
      if (os) {
        const existing = options.find(o => o.letter === os.letter);
        if (!existing) { options.push(os); current = os; }
        else current = existing;
        continue;
      }

      if (current) current.text = repairText(current.text + " " + line);
      else stem.push(line);
    }

    let qtext = repairText(stem.join(" "));

    // Some PDF text layers put options on the same line as the stem.
    if (options.length < 4) {
      const inline = qtext.match(/^(.*?)(?:\s+|^)(?:\(A\)|A[.):])\s+/i);
      if (inline) {
        const firstOptIndex = qtext.search(/(?:^|\s)(?:\(A\)|A[.):])\s+/i);
        if (firstOptIndex > 0) {
          const maybe = qtext.slice(firstOptIndex);
          qtext = qtext.slice(0, firstOptIndex).trim();
          const rx = /(?:^|\s)(?:\(([A-D])\)|([A-D])[.):])\s+([\s\S]*?)(?=\s+(?:\([A-D]\)|[A-D][.):])\s+|$)/gi;
          for (const m of maybe.matchAll(rx)) {
            const letter = answerLetter(m[1] || m[2]);
            if (letter && m[3]) options.push({ letter, text: clean(m[3]) });
          }
        }
      }
    }

    options.sort((a, b) => "ABCD".indexOf(a.letter) - "ABCD".indexOf(b.letter));
    const unique = new Set(options.map(o => norm(o.text)));

    if (qtext.length < 8 || options.length !== 4 || unique.size !== 4) return null;
    if (isInstruction(qtext)) return null;

    const english = qtext.match(/[A-Za-z]/g) || [];
    const hindi = qtext.match(/[\u0900-\u097F]/g) || [];
    if (english.length < 5 || english.length < hindi.length * 1.2) return null;

    return {
      id: `PDF8-${Date.now()}-${group.number}-${Math.random().toString(36).slice(2, 8)}`,
      number: group.number,
      question: qtext,
      text: qtext,
      options: options.map(o => repairText(o.text)),
      correctAnswer: "",
      correctIndex: -1,
      explanation: "",
      solution: "",
      subject: "NEET",
      chapter: "",
      topic: "",
      difficulty: "Medium",
      marks: 4,
      negativeMarks: 1,
      source: "PDF Import",
      sourcePage: group.page,
      needsReview: true,
      language: "English"
    };
  }

  function dedupe(questions) {
    const seen = new Set();
    return (questions || []).filter(q => {
      const key = norm(q.question || q.text);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function filterEnglish(questions) {
    const out = [];
    for (const q of dedupe(questions)) {
      const question = clean(q.question || q.text).replace(/[\u0900-\u097F]/g, " ").replace(/\s+/g, " ").trim();
      const options = (q.options || []).map(x => clean(x).replace(/[\u0900-\u097F]/g, " ").replace(/\s+/g, " ").trim());
      if (question.length < 8 || options.length !== 4 || options.some(x => x.length < 1)) continue;
      const letters = (question.match(/[A-Za-z]/g) || []).length;
      if (letters < 5) continue;
      out.push({ ...q, question, text: question, options, language: "English" });
    }
    return out;
  }

  function answerKeyFromPages(pages, questions) {
    const map = new Map();
    for (const pg of pages || []) {
      for (const raw of pg.lines || []) {
        const line = clean(raw);
        let m;
        const rx = /(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[-.):]?\s*(?:answer|ans|correct\s*answer)?\s*[:=-]?\s*[([\s]*([A-D1-4])[\])]?/gi;
        while ((m = rx.exec(line))) {
          const a = answerLetter(m[2]);
          if (a) map.set(Number(m[1]), a);
        }
      }
    }
    return (questions || []).map(q => {
      const a = map.get(Number(q.number));
      if (a && !q.correctAnswer) return { ...q, correctAnswer: a, correctIndex: "ABCD".indexOf(a), needsReview: false };
      return q;
    });
  }

  function fingerprint(file) {
    return [file.name || "", file.size || 0, file.lastModified || 0, file.type || ""].join("::");
  }

  function clearOldPdfState() {
    [KEYS.pool, KEYS.meta].forEach(k => localStorage.removeItem(k));
    [KEYS.active, KEYS.activeTest, KEYS.activeSource, KEYS.activeId].forEach(k => sessionStorage.removeItem(k));
    // Remove all known PDF session namespaces from previous implementations.
    Object.keys(localStorage).forEach(k => {
      if (/^(CBT_PDF_|CBT_ISO_V2_PDF_|PDF_CBT_)/.test(k)) localStorage.removeItem(k);
    });
  }

  function saveFresh(questions, file) {
    const id = `pdf-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fresh = questions.map((q, i) => ({
      ...q,
      id: `PDF8-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      sequence: i + 1,
      importedTestId: id,
      sourceFile: file.name,
      importedAt: new Date().toISOString()
    }));

    // New PDF is authoritative. Never append to the previous PDF pool.
    localStorage.setItem(KEYS.pool, JSON.stringify(fresh));
    localStorage.setItem(KEYS.meta, JSON.stringify({
      id, fileName: file.name, fingerprint: fingerprint(file), questionCount: fresh.length, importedAt: new Date().toISOString()
    }));

    sessionStorage.setItem(KEYS.active, JSON.stringify(fresh));
    sessionStorage.setItem(KEYS.activeTest, JSON.stringify({
      id, title: file.name.replace(/\.pdf$/i, ""), duration: 180,
      questions: fresh, questionIds: fresh.map(q => q.id), totalQuestions: fresh.length,
      source: "PDF", sourceFile: file.name, importedAt: new Date().toISOString()
    }));
    sessionStorage.setItem(KEYS.activeSource, "PDF");
    sessionStorage.setItem(KEYS.activeId, id);

    return fresh;
  }

  function renderPreview(qs) {
    const box = $("questionPreview");
    if (!box) return;
    box.innerHTML = qs.slice(0, 5).map((q, i) =>
      `<div style="margin:10px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px">` +
      `<strong>Q${i + 1}.</strong> ${escapeHtml(q.question)}<br>` +
      `<small>${q.options.map((o, j) => `${String.fromCharCode(65+j)}) ${escapeHtml(o)}`).join(" &nbsp; ")}</small></div>`
    ).join("") + (qs.length > 5 ? `<div>Showing first 5 of ${qs.length} questions.</div>` : "");
  }

  async function convert(file) {
    if (!file || !/\.pdf$/i.test(file.name)) throw new Error("Please select a PDF file.");
    clearOldPdfState();
    setStatus("📄 Reading the new PDF…");

    let pages = [];
    try { pages = await extractPdfText(file); }
    catch (e) { console.warn("PDF text extraction failed", e); }

    const quality = pageTextQuality(pages);
    let questions = parsePages(pages);

    // The screenshot failure is a broken font/text layer: words look like Mksfj/k…
    // If readability or question yield is poor, OCR the actual rendered PDF pages.
    const badTextLayer = quality.score < 0.34 || questions.length < 0.70 * Math.max(1, quality.qStarts) || questions.length < 20;
    if (badTextLayer) {
      setStatus(`🧠 PDF text layer looks unreliable. Switching to visual OCR…`);
      try {
        const ocr = await ocrPages(file);
        const ocrQuestions = parsePages(ocr);
        if (ocrQuestions.length > questions.length || readabilityScore(ocr.map(p => p.lines.join(" ")).join(" ")) > quality.score) {
          pages = ocr;
          questions = ocrQuestions;
        }
      } catch (e) {
        console.warn("OCR fallback failed", e);
        if (!questions.length) throw e;
      }
    }

    questions = answerKeyFromPages(pages, filterEnglish(questions));
    questions = dedupe(questions);

    if (!questions.length) throw new Error("No complete English 4-option questions could be reconstructed from this PDF.");

    const fresh = saveFresh(questions, file);
    renderPreview(fresh);

    const review = fresh.filter(q => q.needsReview).length;
    setStatus(`✅ NEW PDF READY\n\nFile: ${file.name}\nDetected: ${fresh.length} questions\nAnswer review: ${review}\n\nOld PDF questions cleared. Ready for CBT.`);
    document.dispatchEvent(new CustomEvent("pdfCbtPoolUpdated", { detail: { questions: fresh } }));
    return fresh;
  }

  function install() {
    const input = $("pdfInput");
    const button = $("convertButton");
    if (!input || !button || button.dataset.rankforgeV8Installed) return;
    button.dataset.rankforgeV8Installed = "1";

    input.addEventListener("change", () => {
      button.disabled = !(input.files && input.files.length);
      if (input.files && input.files[0]) setStatus(`Selected: ${input.files[0].name}`);
    });

    // CAPTURE handler is intentional: it blocks every older competing PDF converter.
    button.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const file = input.files && input.files[0];
      if (!file) { setStatus("Select a PDF first."); return; }
      button.disabled = true;
      try {
        await convert(file);
      } catch (e) {
        console.error("[RankForge V8]", e);
        setStatus(`❌ PDF conversion failed\n\n${e.message || "Unknown error"}`);
      } finally {
        button.disabled = false;
      }
    }, true);

    // Native Android/Chrome picker: clicking the label/input remains untouched.
    console.log("✅ RankForge V8 FINAL PDF engine installed");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();

  window.RankForgePDFV8 = { convert, extractPdfText, ocrPages, parsePages, clearOldPdfState };
})();
