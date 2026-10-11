(() => {
"use strict";

/* ============================================================
   RANKFORGE PDF → CBT V9 CLEAN ENGINE
   - English column only
   - Layout-aware PDF.js extraction
   - No blind OCR on good native PDFs
   - 1/2/3/4 AND A/B/C/D options
   - Question reconstruction
   - Header/footer/instruction filtering
   - Duplicate protection
   - 180-question safety limit
   - Existing CBT handoff
   ============================================================ */

const POOL_KEY = "pdfCbtQuestions";
const ACTIVE_KEY = "CBT_ACTIVE_TEST";
const SOURCE_KEY = "CBT_ACTIVE_SOURCE";
const ENGINE_KEY = "PDF_CBT_ENGINE_VERSION";

const $ = id => document.getElementById(id);

function clean(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isGarbage(s) {
  const x = clean(s);
  if (!x) return true;

  const letters = (x.match(/[A-Za-z]/g) || []).length;
  const weird = (x.match(/[^\x20-\x7E\n]/g) || []).length;

  if (letters < 3) return false;

  return (
    /(?:dFku|dkj\.k|pkyd|lEiw\.kZ|nksuksa|lgh|O;k\[;k|foyfxr|LFkkukUrfjr)/i.test(x) ||
    weird > Math.max(8, letters * 0.18)
  );
}

function isNoise(line) {
  const x = clean(line);
  if (!x) return true;

  if (/^(?:PHYSICS|CHEMISTRY|BIOLOGY)\s*\(/i.test(x)) return true;
  if (/^CAREERWILL\b/i.test(x)) return true;
  if (/^EASY TO LEARN/i.test(x)) return true;
  if (/^\d{1,3}$/.test(x)) return true;
  if (/^(?:PAGE|P\.?)\s*\d+$/i.test(x)) return true;
  if (/^https?:\/\//i.test(x)) return true;
  if (/^(?:instructions?|general instructions?)$/i.test(x)) return true;

  return false;
}

function optionMatch(line) {
  return line.match(
    /^\s*(?:\(([1-4])\)|([A-D]))\s*[.)\-:]\s*(.+)$/i
  );
}

function questionMatch(line) {
  return line.match(
    /^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)\-:]\s*(.+)$/i
  );
}

function splitInlineOptions(text) {
  const s = clean(text);

  const re =
    /(?:^|\s)(?:\(([1-4])\)|([A-D]))\s*[.)\-:]\s+/gi;

  const matches = [...s.matchAll(re)];

  if (matches.length < 2) {
    return null;
  }

  const first = matches[0];

  const qText = clean(
    s.slice(0, first.index)
  );

  if (qText.length < 5) {
    return null;
  }

  const options = [];

  for (let i = 0; i < matches.length && options.length < 4; i++) {
    const start =
      matches[i].index + matches[i][0].length;

    const end =
      i + 1 < matches.length
        ? matches[i + 1].index
        : s.length;

    const value =
      clean(s.slice(start, end));

    if (value) options.push(value);
  }

  if (options.length < 2) {
    return null;
  }

  return {
    question: qText,
    options
  };
}

/* ------------------------------------------------------------
   PAGE → ENGLISH COLUMN LINES
   ------------------------------------------------------------ */

async function extractEnglishPages(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF.js is not loaded.");
  }

  const buffer = await file.arrayBuffer();

  const pdf =
    await pdfjsLib.getDocument({
      data: buffer
    }).promise;

  const pages = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {

    const page =
      await pdf.getPage(pageNo);

    const viewport =
      page.getViewport({ scale: 1 });

    const content =
      await page.getTextContent({
        disableCombineTextItems: false
      });

    const raw = [];

    for (const item of content.items || []) {
      const text = clean(item.str);

      if (!text) continue;

      const tr =
        Array.isArray(item.transform)
          ? item.transform
          : [];

      raw.push({
        x: Number(tr[4] || 0),
        y: Number(tr[5] || 0),
        text
      });
    }

    if (!raw.length) {
      pages.push({
        pageNo,
        width: viewport.width,
        height: viewport.height,
        rows: []
      });
      continue;
    }

    /*
     * Detect two-column layout from the largest horizontal gap.
     */
    const xs =
      raw
        .map(x => x.x)
        .sort((a,b) => a-b);

    let splitX = viewport.width / 2;
    let largestGap = 0;

    for (let i = 1; i < xs.length; i++) {
      const gap = xs[i] - xs[i - 1];

      if (gap > largestGap) {
        largestGap = gap;
        splitX = (xs[i] + xs[i - 1]) / 2;
      }
    }

    const twoColumn =
      largestGap > viewport.width * 0.12;

    let englishItems;

    if (twoColumn) {
      /*
       * Source PDFs are English LEFT / Hindi RIGHT.
       * Keep the left column only.
       */
      englishItems =
        raw.filter(x => x.x < splitX);
    } else {
      englishItems = raw;
    }

    /*
     * Rebuild physical rows using Y coordinates.
     */
    const rows = [];

    for (const item of englishItems) {

      let row = null;

      for (const r of rows) {
        if (Math.abs(r.y - item.y) <= 3.5) {
          row = r;
          break;
        }
      }

      if (!row) {
        row = {
          y: item.y,
          items: []
        };

        rows.push(row);
      }

      row.items.push(item);
    }

    rows.sort((a,b) => b.y - a.y);

    const lines =
      rows
        .map(row => {
          row.items.sort((a,b) => a.x - b.x);

          return clean(
            row.items
              .map(x => x.text)
              .join(" ")
          );
        })
        .filter(line => !isNoise(line));

    pages.push({
      pageNo,
      width: viewport.width,
      height: viewport.height,
      rows: lines
    });
  }

  return pages;
}

/* ------------------------------------------------------------
   QUESTION RECONSTRUCTION
   ------------------------------------------------------------ */

function parsePages(pages) {

  const questions = [];

  let current = null;

  function flush() {

    if (!current) return;

    current.question =
      clean(current.question);

    current.options =
      current.options
        .map(clean)
        .filter(Boolean)
        .slice(0, 4);

    if (
      current.question.length >= 5 &&
      current.options.length >= 2 &&
      !isGarbage(current.question)
    ) {
      questions.push({
        number: current.number,
        text: current.question,
        options: current.options,
        sourcePage: current.sourcePage
      });
    }

    current = null;
  }

  for (const page of pages) {

    for (let line of page.rows) {

      line = clean(line);

      if (!line || isNoise(line)) continue;

      /*
       * Ignore obvious Hindi legacy-font garbage.
       * We never merge right-column text into English.
       */
      if (isGarbage(line)) continue;

      const qm = questionMatch(line);

      if (qm) {

        flush();

        const inline =
          splitInlineOptions(qm[2]);

        if (inline) {
          current = {
            number: Number(qm[1]),
            question: inline.question,
            options: inline.options,
            sourcePage: page.pageNo
          };

          flush();
        } else {
          current = {
            number: Number(qm[1]),
            question: qm[2],
            options: [],
            sourcePage: page.pageNo
          };
        }

        continue;
      }

      const om = optionMatch(line);

      if (om && current) {

        current.options.push(
          clean(om[3])
        );

        continue;
      }

      if (current) {

        if (current.options.length > 0) {

          const i =
            current.options.length - 1;

          current.options[i] =
            clean(
              current.options[i] +
              " " +
              line
            );

        } else {

          /*
           * If a new numbered line is hidden inside
           * a malformed extraction, don't swallow it.
           */
          current.question =
            clean(
              current.question +
              " " +
              line
            );
        }
      }
    }
  }

  flush();

  return questions;
}

/* ------------------------------------------------------------
   VALIDATION + DEDUPE
   ------------------------------------------------------------ */

function normalizeQuestions(raw, fileName, moduleName) {

  const out = [];
  const seen = new Set();

  for (let i = 0; i < raw.length && out.length < 180; i++) {

    const q = raw[i];

    let text = clean(q.text);

    let options =
      (q.options || [])
        .map(clean)
        .filter(Boolean)
        .slice(0, 4);

    if (
      text.length < 5 ||
      options.length < 2 ||
      isGarbage(text)
    ) continue;

    /*
     * Remove accidental numbering from text.
     */
    text =
      text.replace(
        /^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)\-:]\s*/i,
        ""
      ).trim();

    /*
     * Reject questions that are obviously just instructions.
     */
    if (
      /^(?:choose|select|mark|read)\s+(?:the\s+)?(?:correct|best)\s+option/i.test(text) &&
      text.length < 80
    ) {
      continue;
    }

    const key =
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    if (!key || seen.has(key)) continue;

    seen.add(key);

    out.push({
      id:
        "PDF-V9-" +
        Date.now() +
        "-" +
        i,

      text,

      question: text,

      options,

      correctAnswer: "",

      answer: "",

      explanation: "",

      solution: "",

      subject:
        detectSubject(text, moduleName),

      chapter: "",

      topic: "",

      difficulty: "Medium",

      marks: 4,

      negativeMarks: 1,

      source:
        moduleName ||
        fileName ||
        "PDF Import",

      sourceType: "pdf",

      pdfPage:
        q.sourcePage || null,

      fileName:
        fileName || ""
    });
  }

  return out;
}

function detectSubject(text, moduleName) {

  const s =
    (text + " " + (moduleName || ""))
      .toLowerCase();

  if (
    /velocity|acceleration|force|momentum|energy|current|resistance|electric|magnetic|wave|motion|projectile|oscillation|optics|thermodynamic/.test(s)
  ) {
    return "Physics";
  }

  if (
    /mole|atomic|chemical|reaction|organic|inorganic|equilibrium|thermodynamic|electrochem|coordination|periodic/.test(s)
  ) {
    return "Chemistry";
  }

  if (
    /cell|plant|animal|gene|dna|rna|enzyme|photosynthesis|respiration|ecology|taxonomy|biology|organism/.test(s)
  ) {
    return "Biology";
  }

  return "Unknown";
}

/* ------------------------------------------------------------
   STORAGE
   ------------------------------------------------------------ */

function savePool(questions) {

  localStorage.setItem(
    POOL_KEY,
    JSON.stringify(questions)
  );

  localStorage.setItem(
    ENGINE_KEY,
    "PDF-CBT-V9-CLEAN"
  );
}

function getPool() {

  try {
    return JSON.parse(
      localStorage.getItem(POOL_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function createActiveTest(questions, fileName, moduleName) {

  const id =
    "PDF-V9-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2,8);

  const test = {

    id,

    testId: id,

    title:
      moduleName ||
      fileName.replace(/\.pdf$/i, "") ||
      "PDF Test",

    name:
      moduleName ||
      fileName,

    source:
      "PDF Import",

    sourceType:
      "pdf",

    fileName,

    questionCount:
      questions.length,

    questions,

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),

    engine:
      "PDF-CBT-V9-CLEAN"
  };

  localStorage.setItem(
    ACTIVE_KEY,
    JSON.stringify(test)
  );

  localStorage.setItem(
    SOURCE_KEY,
    "PDF"
  );

  localStorage.setItem(
    "CBT_ACTIVE_TEST_ID",
    id
  );

  localStorage.setItem(
    "CBT_ACTIVE_TEST_SOURCE",
    "PDF Import"
  );

  localStorage.setItem(
    "CBT_PDF_FILE_NAME",
    fileName
  );

  return test;
}

/* ------------------------------------------------------------
   STATUS
   ------------------------------------------------------------ */

function status(msg) {

  const box = $("status");

  if (box) {
    box.textContent = msg;
  }

  console.log("[PDF-V9]", msg);
}

/* ------------------------------------------------------------
   MAIN CONVERTER
   ------------------------------------------------------------ */

async function convertPDFV9() {

  const input = $("pdfInput");

  if (!input || !input.files.length) {
    alert("Please select a PDF first.");
    return;
  }

  const file = input.files[0];

  const moduleInput =
    $("moduleName");

  const moduleName =
    moduleInput?.value.trim() ||
    file.name.replace(/\.pdf$/i, "");

  const button =
    $("convertButton");

  if (button) {
    button.disabled = true;
  }

  try {

    status(
      "📖 Reading PDF layout...\n" +
      "English column detection active."
    );

    const pages =
      await extractEnglishPages(file);

    status(
      "🔎 Reconstructing English questions...\n" +
      `${pages.length} PDF pages processed.`
    );

    let raw =
      parsePages(pages);

    let questions =
      normalizeQuestions(
        raw,
        file.name,
        moduleName
      );

    if (!questions.length) {

      throw new Error(
        "No clean MCQ questions detected. " +
        "The PDF text layer may be image-only."
      );
    }

    /*
     * IMPORTANT:
     * Replace old corrupted pool rather than mixing
     * the previous 86 garbage questions into the new PDF.
     */
    savePool(questions);

    const test =
      createActiveTest(
        questions,
        file.name,
        moduleName
      );

    status(
      "✅ PDF CONVERSION COMPLETE\n\n" +
      `Module: ${moduleName}\n` +
      `Pages read: ${pages.length}\n` +
      `Clean questions: ${questions.length}\n` +
      `Engine: PDF-CBT-V9-CLEAN\n\n` +
      "Hindi column: removed\n" +
      "OCR garbage: rejected\n" +
      "Question reconstruction: ON\n" +
      "4-option reconstruction: ON\n" +
      "CBT handoff: READY"
    );

    /*
     * Update visible pool counters if present.
     */
    try {
      if (typeof updatePoolStats === "function") {
        updatePoolStats();
      }
    } catch {}

    window.dispatchEvent(
      new CustomEvent(
        "PDF_V9_CONVERSION_COMPLETE",
        {
          detail: test
        }
      )
    );

  } catch (err) {

    console.error(err);

    status(
      "❌ PDF conversion failed\n\n" +
      err.message
    );

    alert(err.message);

  } finally {

    if (button) {
      button.disabled = false;
    }
  }
}

/* ------------------------------------------------------------
   OPEN CLEAN CBT
   ------------------------------------------------------------ */

function openCleanCBT() {

  const pool = getPool();

  if (!pool.length) {
    alert(
      "No clean PDF questions available.\n" +
      "Convert a PDF first."
    );
    return;
  }

  window.location.href = "./cbt.html";
}

/* ------------------------------------------------------------
   CLEAR OLD CORRUPTED POOL
   ------------------------------------------------------------ */

function clearV9Pool() {

  localStorage.removeItem(POOL_KEY);
  localStorage.removeItem(ACTIVE_KEY);
  localStorage.removeItem(SOURCE_KEY);

  status(
    "🗑️ PDF question pool cleared."
  );

  try {
    if (typeof updatePoolStats === "function") {
      updatePoolStats();
    }
  } catch {}
}

/* ------------------------------------------------------------
   INSTALL — CAPTURE PHASE
   Stops old broken PDF parser listeners.
   ------------------------------------------------------------ */

function installV9() {

  const button =
    $("convertButton");

  if (!button) {
    setTimeout(installV9, 500);
    return;
  }

  /*
   * Prevent every older click handler from running.
   */
  button.addEventListener(
    "click",
    function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      convertPDFV9();
    },
    true
  );

  /*
   * Expose clean functions for existing UI.
   */
  window.convertPDFV9 =
    convertPDFV9;

  window.openCleanCBT =
    openCleanCBT;

  window.clearV9Pool =
    clearV9Pool;

  window.PDF_CBT_V9_READY = true;

  console.log(
    "✅ PDF-CBT V9 CLEAN ENGINE ACTIVE"
  );
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    installV9
  );
} else {
  installV9();
}

})();
