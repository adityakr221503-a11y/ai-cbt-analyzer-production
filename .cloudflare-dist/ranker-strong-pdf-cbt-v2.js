(function () {
  "use strict";

  const POOL_KEY = "pdfCbtQuestions";
  const REVIEW_KEY = "pdfCbtReviewQueueV2";
  const META_KEY = "pdfCbtImportMetaV2";

  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const norm = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function optionLetter(x) {
    const s = clean(x).toUpperCase().replace(/[()[\].:]/g, "");
    if (/^[ABCD]$/.test(s)) return s;
    if (/^[1-4]$/.test(s)) return "ABCD"[Number(s) - 1];
    return "";
  }

  function parseOption(line) {
    const m = String(line).match(
      /^\s*(?:[\(\[]?\s*([A-Da-d1-4])\s*[\)\].:\-])\s*(.+?)\s*$/
    );
    if (!m) return null;

    const letter = optionLetter(m[1]);
    const text = clean(m[2]);

    if (!letter || !text) return null;
    return { letter, text };
  }

  function parseQuestionStart(line) {
    const m = String(line).match(
      /^\s*(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[\.\):\-]\s*(.+)$/i
    );

    if (!m) return null;

    return {
      number: Number(m[1]),
      text: clean(m[2])
    };
  }

  function parseAnswer(line) {
    const m = String(line).match(
      /\b(?:correct\s*answer|answer|ans|correct)\s*[:=\-]?\s*(?:option\s*)?[\(\[]?\s*([A-D1-4])\s*[\)\]]?/i
    );

    return m ? optionLetter(m[1]) : "";
  }

  function buildQuestion(number, lines, page) {
    const stem = [];
    const options = [];
    let answer = "";

    for (const raw of lines) {
      const line = clean(raw);
      if (!line) continue;

      const opt = parseOption(line);

      if (opt) {
        if (!options.some(o => o.letter === opt.letter)) {
          options.push(opt);
        }
        continue;
      }

      const ans = parseAnswer(line);

      if (ans) {
        answer = ans;
        continue;
      }

      if (options.length < 4) {
        stem.push(line);
      }
    }

    if (!clean(stem.join(" "))) return null;

    // STRICT CBT RULE: exactly four options.
    if (options.length !== 4) return null;

    const unique = new Set(options.map(o => norm(o.text)));

    if (unique.size !== 4) return null;

    const ordered = options
      .sort((a, b) => "ABCD".indexOf(a.letter) - "ABCD".indexOf(b.letter))
      .map(o => o.text);

    return {
      id:
        "PDFV2-" +
        Date.now() +
        "-" +
        number +
        "-" +
        Math.random().toString(36).slice(2, 8),

      question: clean(stem.join(" ")),

      options: ordered,

      correctAnswer: answer || "",

      correctIndex: answer ? "ABCD".indexOf(answer) : -1,

      source: "PDF Import V2",

      sourcePage: page || null,

      confidence: answer ? "HIGH" : "MEDIUM",

      needsReview: !answer
    };
  }

  function parseLines(lines, page) {
    const groups = [];
    let current = null;

    for (const raw of lines) {
      const line = clean(raw);
      if (!line) continue;

      const q = parseQuestionStart(line);

      if (q) {
        if (current) groups.push(current);

        current = {
          number: q.number,
          lines: [q.text]
        };
      } else if (current) {
        current.lines.push(line);
      }
    }

    if (current) groups.push(current);

    return groups
      .map(g => buildQuestion(g.number, g.lines, page))
      .filter(Boolean);
  }

  function groupPDFText(items) {
    const rows = [];

    for (const item of items) {
      const text = clean(item.str);
      if (!text) continue;

      const y =
        Math.round(((item.transform && item.transform[5]) || 0) * 2) / 2;

      let row = rows.find(r => Math.abs(r.y - y) <= 2.5);

      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }

      row.items.push(item);
    }

    rows.sort((a, b) => b.y - a.y);

    return rows.map(row =>
      row.items
        .sort(
          (a, b) =>
            ((a.transform && a.transform[4]) || 0) -
            ((b.transform && b.transform[4]) || 0)
        )
        .map(x => x.str)
        .join(" ")
    );
  }

  async function extractPDFText(file) {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js is not loaded");
    }

    const buffer = await file.arrayBuffer();

    const pdf = await window.pdfjsLib
      .getDocument({ data: buffer })
      .promise;

    const pages = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);

      const content = await page.getTextContent();

      pages.push({
        page: p,
        lines: groupPDFText(content.items)
      });
    }

    return pages;
  }

  async function loadOCR() {
    if (window.Tesseract) return window.Tesseract;

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src =
        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);
    });

    return window.Tesseract;
  }

  async function OCRPDF(file) {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js is not loaded");
    }

    const Tesseract = await loadOCR();

    const buffer = await file.arrayBuffer();

    const pdf = await window.pdfjsLib
      .getDocument({ data: buffer })
      .promise;

    const pages = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);

      const viewport = page.getViewport({
        scale: 2.5
      });

      const canvas = document.createElement("canvas");

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const ctx = canvas.getContext("2d", {
        willReadFrequently: true
      });

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;

      // Image preprocessing:
      // grayscale + contrast + mild sharpening/threshold.
      const image = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      for (let i = 0; i < image.data.length; i += 4) {
        const r = image.data[i];
        const g = image.data[i + 1];
        const b = image.data[i + 2];

        let gray =
          0.299 * r +
          0.587 * g +
          0.114 * b;

        gray = (gray - 128) * 1.25 + 128;

        if (gray < 180) {
          gray = Math.max(0, gray - 15);
        } else {
          gray = Math.min(255, gray + 10);
        }

        image.data[i] = gray;
        image.data[i + 1] = gray;
        image.data[i + 2] = gray;
      }

      ctx.putImageData(image, 0, 0);

      const result = await Tesseract.recognize(
        canvas,
        "eng",
        {
          logger(message) {
            if (
              window.__pdfV2Progress &&
              message.status === "recognizing text"
            ) {
              window.__pdfV2Progress(
                Math.round((message.progress || 0) * 100),
                p
              );
            }
          }
        }
      );

      pages.push({
        page: p,
        lines: String(result.data.text || "").split(/\r?\n/)
      });

      canvas.width = 1;
      canvas.height = 1;
    }

    return pages;
  }

  function dedupe(questions) {
    const seen = new Set();

    return questions.filter(q => {
      const key = norm(q.question);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function addToPool(questions, fileName) {
    const pool = load(POOL_KEY, []);

    const existing = new Set(
      pool.map(q => norm(q.question))
    );

    const fresh = questions.filter(
      q => !existing.has(norm(q.question))
    );

    save(
      POOL_KEY,
      pool.concat(fresh)
    );

    const review = load(REVIEW_KEY, []);

    const reviewItems = fresh
      .filter(q => q.needsReview)
      .map(q => ({
        id: q.id,
        question: q.question,
        sourcePage: q.sourcePage,
        reason: "Answer key not confidently detected"
      }));

    save(
      REVIEW_KEY,
      review.concat(reviewItems)
    );

    save(
      META_KEY,
      {
        fileName,
        importedAt: new Date().toISOString(),
        detected: questions.length,
        added: fresh.length,
        skipped: questions.length - fresh.length,
        reviewCount: reviewItems.length
      }
    );

    return fresh.length;
  }

  function showStatus(message) {
    const selectors = [
      "#statusMessage",
      "#conversionStatus",
      ".status-message",
      "#pdfStatus"
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) {
        element.textContent = message;
        return;
      }
    }

    console.log("[PDF CBT V2]", message);
  }

  async function convert(file) {
    showStatus("Reading PDF…");

    let pages = [];

    try {
      pages = await extractPDFText(file);
    } catch (error) {
      console.warn(
        "[PDF CBT V2] Text extraction failed",
        error
      );
    }

    let questions = dedupe(
      pages.flatMap(page =>
        parseLines(page.lines, page.page)
      )
    );

    // OCR fallback for scanned / image / blurred PDFs.
    if (!questions.length) {
      showStatus(
        "Scanned/blurred PDF detected — starting OCR…"
      );

      window.__pdfV2Progress = function (percent, page) {
        showStatus(
          "OCR page " +
            page +
            ": " +
            percent +
            "%"
        );
      };

      try {
        const OCRPages = await OCRPDF(file);

        questions = dedupe(
          OCRPages.flatMap(page =>
            parseLines(page.lines, page.page)
          )
        );
      } catch (error) {
        console.error(
          "[PDF CBT V2] OCR failed",
          error
        );
      }

      window.__pdfV2Progress = null;
    }

    if (!questions.length) {
      showStatus(
        "No valid 4-option MCQs detected. Nothing was invented."
      );

      return;
    }

    const added = addToPool(
      questions,
      file.name
    );

    showStatus(
      "Imported " +
        added +
        " new valid MCQs from " +
        file.name +
        "."
    );

    document.dispatchEvent(
      new CustomEvent("pdfCbtPoolUpdated")
    );

    console.log(
      "[PDF CBT V2]",
      {
        detected: questions.length,
        added
      }
    );
  }

  function install() {
    const input =
      document.querySelector("#pdfInput");

    const button =
      document.querySelector("#convertButton");

    if (!input || !button) {
      console.warn(
        "[PDF CBT V2] PDF controls not found"
      );
      return;
    }

    if (button.dataset.pdfV2Installed) {
      return;
    }

    button.dataset.pdfV2Installed = "1";

    button.addEventListener(
      "click",
      async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const file =
          input.files &&
          input.files[0];

        if (!file) {
          showStatus(
            "Select a PDF first."
          );
          return;
        }

        button.disabled = true;

        try {
          await convert(file);
        } catch (error) {
          console.error(
            "[PDF CBT V2]",
            error
          );

          showStatus(
            "Conversion failed. Check console."
          );
        } finally {
          button.disabled = false;
        }
      },
      true
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      install
    );
  } else {
    install();
  }
})();
