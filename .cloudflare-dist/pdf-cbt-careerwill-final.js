(function () {
  "use strict";

  const POOL = "pdfCbtQuestions";
  const ACTIVE = "CBT_ACTIVE_QUESTIONS";
  const TEST = "CBT_ACTIVE_TEST";
  const TEST_ID = "CBT_ACTIVE_TEST_ID";

  const clean = s => String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function getPDFJS() {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js is not loaded");
    }
    return window.pdfjsLib;
  }

  /*
   * Careerwill bilingual PDF:
   * LEFT  = English
   * RIGHT = Hindi
   *
   * Filter columns BEFORE rebuilding rows.
   */
  function selectEnglish(items, pageWidth) {
    const data = items
      .filter(x => clean(x.str))
      .map(x => {
        const t = x.transform || [];
        const xPos = Number(t[4] || 0);
        const width = Math.abs(Number(x.width || 0));

        return {
          raw: x,
          x: xPos,
          center: xPos + width / 2
        };
      });

    if (!data.length) return [];

    const leftLimit = pageWidth * 0.49;

    let selected = data
      .filter(x => x.center <= leftLimit)
      .map(x => x.raw);

    /*
     * If this is actually a single-column PDF,
     * don't destroy its text.
     */
    if (selected.length < Math.max(10, data.length * 0.20)) {
      selected = data.map(x => x.raw);
    }

    return selected;
  }

  function rebuildRows(items) {
    const sorted = [...items].sort((a, b) => {
      const ay = Number((a.transform || [])[5] || 0);
      const by = Number((b.transform || [])[5] || 0);

      if (Math.abs(by - ay) > 3) {
        return by - ay;
      }

      return Number((a.transform || [])[4] || 0) -
             Number((b.transform || [])[4] || 0);
    });

    const rows = [];

    for (const item of sorted) {
      const t = item.transform || [];
      const x = Number(t[4] || 0);
      const y = Number(t[5] || 0);
      const text = String(item.str || "");

      let target = null;

      for (let i = rows.length - 1; i >= 0; i--) {
        if (Math.abs(rows[i].y - y) <= 3.5) {
          target = rows[i];
          break;
        }

        if (rows[i].y < y - 6) break;
      }

      if (!target) {
        target = {
          y,
          parts: []
        };
        rows.push(target);
      }

      target.parts.push({
        x,
        width: Number(item.width || 0),
        text
      });
    }

    return rows
      .sort((a, b) => b.y - a.y)
      .map(row => {
        row.parts.sort((a, b) => a.x - b.x);

        let result = "";

        row.parts.forEach((part, i) => {
          if (!result) {
            result = part.text;
            return;
          }

          const prev = row.parts[i - 1];
          const gap =
            part.x - (prev.x + Math.max(prev.width, 0));

          if (gap > 1.5 && !/\s$/.test(result)) {
            result += " ";
          }

          result += part.text;
        });

        return clean(result);
      })
      .filter(Boolean);
  }

  function isNoise(line) {
    const s = clean(line);

    if (!s) return true;
    if (/^page\s*\d+$/i.test(s)) return true;
    if (/^\d+\s*\/\s*\d+$/.test(s)) return true;
    if (/^career\s*will/i.test(s)) return true;
    if (/^www\./i.test(s)) return true;

    return false;
  }

  function isQuestionStart(line) {
    return /^\s*\d{1,3}\s*[\.\)]\s+/.test(line);
  }

  function extractOptions(text) {
    /*
     * Numbered:
     * (1) ...
     * (2) ...
     * (3) ...
     * (4) ...
     */
    const numbered = [];
    const nr = /\(?([1-4])\)\s*/g;

    let m;

    while ((m = nr.exec(text))) {
      numbered.push({
        start: m.index,
        end: nr.lastIndex
      });
    }

    if (numbered.length >= 2) {
      const result = [];

      for (let i = 0; i < numbered.length; i++) {
        const start = numbered[i].end;
        const end =
          i + 1 < numbered.length
            ? numbered[i + 1].start
            : text.length;

        const value = clean(text.slice(start, end));

        if (value) result.push(value);
      }

      if (result.length >= 2) {
        return result.slice(0, 4);
      }
    }

    /*
     * Lettered:
     * A) ...
     * B) ...
     * C) ...
     * D) ...
     */
    const letters = [];
    const lr = /(?:^|\s)([A-Da-d])[\.\)]\s*/g;

    while ((m = lr.exec(text))) {
      letters.push({
        start: m.index,
        end: lr.lastIndex
      });
    }

    if (letters.length >= 2) {
      const result = [];

      for (let i = 0; i < letters.length; i++) {
        const start = letters[i].end;
        const end =
          i + 1 < letters.length
            ? letters[i + 1].start
            : text.length;

        const value = clean(text.slice(start, end));

        if (value) result.push(value);
      }

      if (result.length >= 2) {
        return result.slice(0, 4);
      }
    }

    return null;
  }

  function parseQuestion(block, index) {
    if (!block.length) return null;

    const first = block[0];

    const match = first.match(
      /^\s*(\d{1,3})\s*[\.\)]\s+(.*)$/
    );

    if (!match) return null;

    const number = Number(match[1]);

    const body = [
      match[2],
      ...block.slice(1)
    ]
      .map(clean)
      .filter(Boolean);

    const combined = clean(body.join(" "));

    if (combined.length < 10) return null;

    const options = extractOptions(combined);

    if (!options || options.length < 2) {
      return null;
    }

    const optionStartCandidates = [
      combined.search(/\(?1\)\s+/),
      combined.search(/(?:^|\s)A[\.\)]\s+/i)
    ].filter(x => x >= 0);

    if (!optionStartCandidates.length) {
      return null;
    }

    const optionStart =
      Math.min(...optionStartCandidates);

    const questionText =
      clean(combined.slice(0, optionStart));

    if (questionText.length < 8) {
      return null;
    }

    return {
      id: "PDF-Q-" + (index + 1),
      number,
      text: questionText,
      question: questionText,
      options,
      correctAnswer: "",
      answer: "",
      subject: "Unknown",
      source: "PDF Import"
    };
  }

  async function extractPDF(file) {
    const lib = getPDFJS();

    const data =
      new Uint8Array(await file.arrayBuffer());

    const pdf =
      await lib.getDocument({ data }).promise;

    const pages = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page =
        await pdf.getPage(pageNo);

      const viewport =
        page.getViewport({ scale: 1 });

      const content =
        await page.getTextContent({
          normalizeWhitespace: false
        });

      /*
       * IMPORTANT:
       * Hindi/right column is filtered here.
       */
      const english =
        selectEnglish(
          content.items || [],
          viewport.width
        );

      const pageRows =
        rebuildRows(english)
          .filter(x => !isNoise(x));

      pages.push(pageRows);
    }

    return pages;
  }

  function buildQuestions(pages) {
    const result = [];
    let current = [];

    function flush() {
      if (!current.length) return;

      const question =
        parseQuestion(
          current,
          result.length
        );

      if (question) {
        result.push(question);
      }

      current = [];
    }

    for (const page of pages) {
      for (const line of page) {
        if (isQuestionStart(line)) {
          flush();
          current = [line];
        } else if (current.length) {
          current.push(line);
        }
      }
    }

    flush();

    /*
     * Deduplicate exact/near-exact imported questions.
     */
    const seen = new Set();
    const unique = [];

    for (const q of result) {
      const key = clean(q.text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");

      if (!key || seen.has(key)) continue;

      seen.add(key);
      unique.push(q);
    }

    return unique.map((q, i) => ({
      ...q,
      id: "PDF-Q-" + (i + 1),
      number: i + 1
    }));
  }

  function saveQuestions(questions, filename) {
    /*
     * REPLACE old pool.
     * No stale 86/102/256 accumulation.
     */
    localStorage.setItem(
      POOL,
      JSON.stringify(questions)
    );

    localStorage.setItem(
      ACTIVE,
      JSON.stringify(questions)
    );

    const title =
      filename
        ? filename.replace(/\.pdf$/i, "")
        : "PDF Imported CBT";

    const test = {
      id: "PDF-CBT-" + Date.now(),
      title,
      name: title,
      source: "PDF Import",
      filename: filename || "",
      questionCount: questions.length,
      totalQuestions: questions.length,
      duration: 180,
      questions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(
      TEST,
      JSON.stringify(test)
    );

    localStorage.setItem(
      TEST_ID,
      test.id
    );

    return test;
  }

  function renderStatus(questions) {
    let box =
      document.getElementById(
        "careerwill-final-status"
      );

    if (!box) {
      box = document.createElement("div");
      box.id = "careerwill-final-status";

      box.style.cssText =
        "margin:14px 0;padding:14px;" +
        "border-radius:12px;" +
        "background:#f1f5f9;" +
        "font-size:15px;line-height:1.6;";

      const button =
        document.getElementById(
          "convertButton"
        );

      if (button && button.parentNode) {
        button.parentNode.appendChild(box);
      } else {
        document.body.appendChild(box);
      }
    }

    box.innerHTML =
      "<b>✅ PDF extraction complete</b><br>" +
      "Clean English questions: <b>" +
      questions.length +
      "</b><br>" +
      "English column: LEFT<br>" +
      "Hindi column: excluded<br>" +
      "OCR: OFF<br>" +
      "Old pool: replaced";

    let start =
      document.getElementById(
        "careerwill-final-start"
      );

    if (!start) {
      start = document.createElement("button");
      start.id =
        "careerwill-final-start";

      start.type = "button";
      start.textContent =
        "🚀 Start PDF CBT";

      start.style.cssText =
        "display:block;margin-top:10px;" +
        "padding:12px 18px;" +
        "border:0;border-radius:10px;" +
        "font-weight:700;cursor:pointer;";

      box.appendChild(start);
    }

    start.disabled = !questions.length;

    start.onclick = function () {
      const test =
        JSON.parse(
          localStorage.getItem(TEST) || "{}"
        );

      if (!test.questions?.length) {
        alert("No PDF questions available.");
        return;
      }

      window.location.href =
        "./cbt.html?source=pdf&pdfcbt=1&t=" +
        Date.now();
    };
  }

  function install() {
    let input =
      document.getElementById("pdfInput");

    let button =
      document.getElementById(
        "convertButton"
      );

    if (!input || !button) {
      console.warn(
        "[PDF FINAL] Controls not found"
      );
      return;
    }

    /*
     * Clone controls to detach listeners
     * installed by legacy inline/old engines.
     */
    const cleanInput =
      input.cloneNode(true);

    input.replaceWith(cleanInput);
    input = cleanInput;

    const cleanButton =
      button.cloneNode(true);

    button.replaceWith(cleanButton);
    button = cleanButton;

    button.addEventListener(
      "click",
      async function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const file =
          input.files?.[0];

        if (!file) {
          alert("Select a PDF first.");
          return;
        }

        button.disabled = true;
        button.textContent =
          "Reading PDF...";

        try {
          const pages =
            await extractPDF(file);

          const questions =
            buildQuestions(pages);

          saveQuestions(
            questions,
            file.name
          );

          renderStatus(questions);

          console.log(
            "================================"
          );
          console.log(
            "PDF FINAL ENGINE"
          );
          console.log(
            "Questions:",
            questions.length
          );
          console.log(
            "================================"
          );

          console.table(
            questions
              .slice(0, 10)
              .map(q => ({
                no: q.number,
                text: q.text,
                options: q.options.length
              }))
          );

        } catch (error) {
          console.error(
            "[PDF FINAL ERROR]",
            error
          );

          alert(
            "PDF extraction failed:\n" +
            (error.message || error)
          );
        } finally {
          button.disabled = false;
          button.textContent =
            "Convert to CBT";
        }
      },
      true
    );

    window.CareerwillPDF = {
      extractPDF,
      buildQuestions,
      saveQuestions
    };

    console.log(
      "✅ CAREERWILL SINGLE PDF ENGINE ACTIVE"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      install,
      { once: true }
    );
  } else {
    install();
  }
})();
