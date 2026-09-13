/* ============================================================
   PDF CBT FINAL — CAREERWILL NATIVE LAYOUT ENGINE
   ------------------------------------------------------------
   NO OCR
   NO BLIND TEXT JOIN
   ENGLISH LEFT COLUMN ONLY
   HINDI RIGHT COLUMN BLOCKED
   POSITION-AWARE LINE RECONSTRUCTION
   QUESTION + 4 OPTIONS REBUILD
   OLD CLICK LISTENERS BLOCKED
   OLD PDF POOL CLEARED
   ============================================================ */

(() => {
  "use strict";

  const INPUT_ID = "pdfInput";
  const BUTTON_ID = "convertButton";

  const input = document.getElementById(INPUT_ID);
  const button = document.getElementById(BUTTON_ID);

  const status =
    document.getElementById("statusBox") ||
    document.getElementById("status");

  const moduleInput =
    document.getElementById("moduleNameInput") ||
    document.getElementById("moduleName");

  if (!input || !button) {
    console.error("❌ PDF CBT controls not found");
    return;
  }

  let running = false;

  const say = (msg) => {
    console.log("[CAREERWILL FINAL]", msg);
    if (status) status.textContent = msg;
  };

  /* ------------------------------------------------------------
     CLEAN PDF TEXT
     ------------------------------------------------------------ */

  function cleanText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[‐-‒–—]/g, "-")
      .replace(/\u200B/g, "")
      .replace(/\u200C/g, "")
      .replace(/\u200D/g, "")
      .replace(/\uFEFF/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  }

  /* ------------------------------------------------------------
     REJECT GARBLED OCR-LIKE TEXT
     ------------------------------------------------------------ */

  function isGarbage(text) {
    const s = cleanText(text);

    if (!s) return true;

    const letters =
      (s.match(/[A-Za-z]/g) || []).length;

    const weird =
      (s.match(/[^\x20-\x7E₹°±×÷≤≥≠∞πμΩ²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g) || []).length;

    if (letters < 2) return true;

    /*
      Careerwill native English text normally has a sensible
      English-letter density. This rejects strings such as:
      SlfY@®eM / dkj / pkj / BRUT THT / etc.
    */
    if (/[A-Za-z]{1,2}[@®©][A-Za-z]/.test(s)) return true;

    if (/^[A-Za-z]{1,3}\s+[A-Za-z]{1,3}\s+[A-Za-z]{1,3}$/.test(s)) {
      return true;
    }

    if (weird > Math.max(5, s.length * 0.12)) {
      return true;
    }

    return false;
  }

  /* ------------------------------------------------------------
     NORMALIZE A PDF TEXT ITEM
     ------------------------------------------------------------ */

  function itemText(item) {
    return cleanText(
      String(item?.str || "")
    );
  }

  /* ------------------------------------------------------------
     GET PDF PAGE TEXT WITH REAL POSITIONS
     ------------------------------------------------------------ */

  async function getEnglishLeftColumn(page) {

    const content =
      await page.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false
      });

    const viewport =
      page.getViewport({ scale: 1 });

    const pageWidth =
      viewport.width;

    /*
      Careerwill bilingual layout:
      English = LEFT
      Hindi   = RIGHT

      Keep only items whose visual center is inside
      the left English column.
    */

    const leftBoundary =
      pageWidth * 0.49;

    const items = [];

    for (const item of content.items || []) {

      const text = itemText(item);

      if (!text) continue;

      const transform =
        item.transform || [];

      const x =
        Number(transform[4] || 0);

      const y =
        Number(transform[5] || 0);

      const width =
        Number(item.width || 0);

      const centerX =
        x + width / 2;

      /*
        Important:
        Do NOT accept text which crosses deeply into
        the Hindi/right column.
      */
      if (centerX > leftBoundary) {
        continue;
      }

      if (isGarbage(text)) {
        continue;
      }

      items.push({
        text,
        x,
        y,
        width,
        height: Number(item.height || 0)
      });
    }

    /*
      PDF coordinates have Y upward.
      Group by visually equal baseline.
    */

    items.sort((a, b) => {

      const dy = b.y - a.y;

      if (Math.abs(dy) > 3) {
        return dy;
      }

      return a.x - b.x;
    });

    const rows = [];

    for (const item of items) {

      let row = null;

      for (const candidate of rows) {

        if (
          Math.abs(candidate.y - item.y) <= 3.2
        ) {
          row = candidate;
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

    rows.sort((a, b) => b.y - a.y);

    const lines = [];

    for (const row of rows) {

      row.items.sort((a, b) => a.x - b.x);

      let line = "";

      let previous = null;

      for (const item of row.items) {

        if (!previous) {
          line = item.text;
        } else {

          const gap =
            item.x -
            (previous.x + previous.width);

          /*
            Small horizontal gap:
            normal space.

            Large gap:
            still space, but never inject random
            characters.
          */

          if (gap > 1.5) {
            line += " ";
          }

          line += item.text;
        }

        previous = item;
      }

      line = cleanText(line);

      if (
        line &&
        !isGarbage(line)
      ) {
        lines.push(line);
      }
    }

    return lines;
  }

  /* ------------------------------------------------------------
     QUESTION / OPTION DETECTION
     ------------------------------------------------------------ */

  const QUESTION_RE =
    /^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[\.\):\-]\s*(.*)$/i;

  const OPTION_RE =
    /^\s*(?:\(([1-4])\)|([1-4])\s*[\.\):\-]|([A-Da-d])\s*[\.\):\-])\s*(.*)$/i;

  function parseQuestions(pageLines) {

    const questions = [];

    let current = null;

    function flush() {

      if (!current) return;

      current.text =
        cleanText(current.text);

      current.options =
        current.options
          .map(cleanText)
          .filter(Boolean);

      /*
        Hard validation.
      */

      if (
        current.text.length >= 8 &&
        current.options.length === 4 &&
        !isGarbage(current.text) &&
        current.options.every(x => !isGarbage(x))
      ) {

        questions.push({
          number: current.number,
          text: current.text,
          options: current.options,
          page: current.page
        });
      }

      current = null;
    }

    for (const page of pageLines) {

      for (const rawLine of page.lines) {

        const line =
          cleanText(rawLine);

        if (!line) continue;

        /*
          Question beginning.
        */

        const q =
          line.match(QUESTION_RE);

        if (q) {

          flush();

          current = {
            number: Number(q[1]),
            text: q[2],
            options: [],
            page: page.page
          };

          continue;
        }

        if (!current) continue;

        /*
          Option beginning.
        */

        const o =
          line.match(OPTION_RE);

        if (o) {

          const optionText =
            cleanText(o[4]);

          if (optionText) {
            current.options.push(optionText);
          }

          continue;
        }

        /*
          Continuation line.

          Before options -> question.
          After options  -> previous option.
        */

        if (
          current.options.length === 0
        ) {

          current.text =
            cleanText(
              current.text +
              " " +
              line
            );

        } else {

          const last =
            current.options.length - 1;

          current.options[last] =
            cleanText(
              current.options[last] +
              " " +
              line
            );
        }
      }
    }

    flush();

    /*
      Remove duplicates but DO NOT destroy legitimate
      sequential question numbers.
    */

    const seen = new Set();

    return questions.filter(q => {

      const key =
        q.number +
        "|" +
        q.text.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  /* ------------------------------------------------------------
     BUILD QUESTION POOL
     ------------------------------------------------------------ */

  function buildQuestions(parsed, fileName) {

    const now =
      Date.now();

    return parsed.map((q, index) => {

      return {
        id:
          "CAREERWILL-PDF-" +
          now +
          "-" +
          q.number +
          "-" +
          index,

        question: q.text,
        questionText: q.text,
        text: q.text,

        options: q.options,

        correctAnswer: "",
        correctIndex: -1,

        solution: "",
        explanation: "",

        subject: "Unknown",
        difficulty: "Medium",

        marks: 4,
        negativeMarks: 1,

        source: fileName,
        pdfPage: q.page,

        sourceEngine:
          "CAREERWILL-NATIVE-LAYOUT-V12"
      };
    });
  }

  /* ------------------------------------------------------------
     CLEAR ALL OLD CORRUPTED PDF DATA
     ------------------------------------------------------------ */

  function clearOldPDFData() {

    const keys = [
      "pdfCbtQuestions",
      "pdfQuestions",
      "cbtQuestions",
      "importedQuestions",
      "pdfQuestionBank",
      "questionBank",
      "CBT_ACTIVE_TEST",
      "CBT_ACTIVE_TEST_ID"
    ];

    for (const key of keys) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    try {
      sessionStorage.removeItem(
        "CBT_ACTIVE_QUESTIONS"
      );

      sessionStorage.removeItem(
        "CBT_ACTIVE_TEST"
      );
    } catch {}
  }

  /* ------------------------------------------------------------
     MAIN CONVERTER
     ------------------------------------------------------------ */

  async function convertCareerwill(file) {

    if (running) return;

    running = true;
    button.disabled = true;

    try {

      clearOldPDFData();

      say(
        "🧹 OLD PDF POOL CLEARED\n\n" +
        "🔒 CAREERWILL NATIVE MODE\n" +
        "English LEFT column only\n" +
        "Hindi RIGHT column blocked\n" +
        "OCR OFF"
      );

      if (
        typeof window.pdfjsLib === "undefined"
      ) {

        throw new Error(
          "PDF.js is not loaded. Refresh the page once."
        );
      }

      const buffer =
        await file.arrayBuffer();

      const pdf =
        await window.pdfjsLib
          .getDocument({
            data: buffer
          })
          .promise;

      const pageData = [];

      for (
        let pageNo = 1;
        pageNo <= pdf.numPages;
        pageNo++
      ) {

        say(
          "📄 Reading native PDF layout: " +
          pageNo +
          " / " +
          pdf.numPages +
          "\n\n" +
          "OCR: OFF\n" +
          "English LEFT column: ON"
        );

        const page =
          await pdf.getPage(pageNo);

        const lines =
          await getEnglishLeftColumn(page);

        pageData.push({
          page: pageNo,
          lines
        });
      }

      say(
        "🧠 Reconstructing questions...\n\n" +
        "No OCR\n" +
        "No Hindi column\n" +
        "Position-aware extraction"
      );

      const parsed =
        parseQuestions(pageData);

      if (!parsed.length) {

        throw new Error(
          "No clean 4-option English questions detected."
        );
      }

      const questions =
        buildQuestions(
          parsed,
          file.name
        );

      /*
        Save ONLY the clean pool.
      */

      localStorage.setItem(
        "pdfCbtQuestions",
        JSON.stringify(questions)
      );

      const title =
        moduleInput &&
        moduleInput.value &&
        moduleInput.value.trim()
          ? moduleInput.value.trim()
          : file.name.replace(
              /\.pdf$/i,
              ""
            );

      const testId =
        "CAREERWILL-" +
        Date.now().toString(36);

      const test = {

        id: testId,
        testId,

        title,
        name: title,

        source: "Careerwill PDF",
        sourceType: "pdf",

        fileName: file.name,

        questionCount:
          questions.length,

        questions,

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString(),

        engine:
          "CAREERWILL-NATIVE-LAYOUT-V12",

        ocr: false,

        englishLeftColumnOnly: true,

        hindiRightColumnBlocked: true
      };

      localStorage.setItem(
        "CBT_ACTIVE_TEST",
        JSON.stringify(test)
      );

      localStorage.setItem(
        "CBT_ACTIVE_TEST_ID",
        testId
      );

      sessionStorage.setItem(
        "CBT_ACTIVE_QUESTIONS",
        JSON.stringify(questions)
      );

      sessionStorage.setItem(
        "CBT_ACTIVE_TEST",
        JSON.stringify(test)
      );

      window.PDF_CBT_FINAL_TEST =
        test;

      say(
        "✅ CAREERWILL PDF READY\n\n" +
        "Questions detected: " +
        questions.length +
        "\n\n" +
        "✅ Native PDF text\n" +
        "✅ English LEFT column\n" +
        "✅ Hindi RIGHT column blocked\n" +
        "✅ 4 options reconstructed\n" +
        "✅ Multi-line questions preserved\n" +
        "✅ OCR OFF\n" +
        "✅ Old corrupted pool cleared\n" +
        "🚀 CBT handoff ready"
      );

      /*
        Update visible pool counter if the page
        already provides that function.
      */

      try {
        if (
          typeof window.updatePoolStats ===
          "function"
        ) {
          window.updatePoolStats();
        }
      } catch {}

    } catch (error) {

      console.error(
        "CAREERWILL FINAL ENGINE ERROR:",
        error
      );

      say(
        "❌ Conversion failed\n\n" +
        (error?.message || error)
      );

      alert(
        error?.message ||
        "PDF conversion failed."
      );

    } finally {

      running = false;
      button.disabled = false;
    }
  }

  /* ------------------------------------------------------------
     BLOCK ALL OLD CONVERTER CLICK HANDLERS
     ------------------------------------------------------------ */

  document.addEventListener(
    "click",
    function(event) {

      const target =
        event.target;

      const clicked =
        target === button ||
        target?.closest?.(
          "#" + BUTTON_ID
        );

      if (!clicked) return;

      /*
        CRITICAL:
        Capture phase + stopImmediatePropagation
        prevents old PDF parser listeners.
      */

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const file =
        input.files &&
        input.files[0];

      if (!file) {

        alert(
          "Please select a PDF first."
        );

        return;
      }

      convertCareerwill(file);

    },
    true
  );

  console.log(
    "================================================"
  );

  console.log(
    "✅ CAREERWILL NATIVE LAYOUT V12 ACTIVE"
  );

  console.log(
    "✅ OCR OFF"
  );

  console.log(
    "✅ ENGLISH LEFT COLUMN ONLY"
  );

  console.log(
    "✅ HINDI RIGHT COLUMN BLOCKED"
  );

  console.log(
    "✅ OLD CLICK PARSERS BLOCKED"
  );

  console.log(
    "================================================"
  );

})();
