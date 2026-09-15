/* =========================================================
   PDF -> CBT FINAL ORCHESTRATOR
   Cumulative / non-destructive layer
   ========================================================= */
(function () {
  "use strict";

  const KEY = "pdfCbtQuestions";
  const META = "pdfCbtModulesV2";

  const $ = id => document.getElementById(id);

  function read(key, fallback) {
    try {
      const x = JSON.parse(localStorage.getItem(key));
      return x == null ? fallback : x;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function pool() {
    const x = read(KEY, []);
    return Array.isArray(x) ? x : [];
  }

  function clean(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function answerIndex(v) {
    const s = clean(v).toUpperCase();
    if (/^[A-D]$/.test(s)) return s.charCodeAt(0) - 65;
    if (/^[1-4]$/.test(s)) return Number(s) - 1;
    return -1;
  }

  function normalize(q, i, moduleName) {
    if (!q || typeof q !== "object") return null;

    const text = clean(
      q.text ||
      q.question ||
      q.questionText ||
      q.question_text ||
      q.statement
    );

    let options = Array.isArray(q.options)
      ? q.options
      : Array.isArray(q.choices)
        ? q.choices
        : Array.isArray(q.answers)
          ? q.answers
          : [];

    options = options
      .map(x => clean(x).replace(/^\(?[A-D1-4]\)?[.)-]\s*/i, ""))
      .filter(Boolean)
      .slice(0, 4);

    if (text.length < 5 || options.length < 2) return null;

    let rawAnswer =
      q.correctAnswer ??
      q.correct ??
      q.answer ??
      q.correctOption ??
      "";

    let ai = answerIndex(rawAnswer);

    let correctAnswer = "";

    if (ai >= 0 && options[ai] !== undefined) {
      correctAnswer = options[ai];
    } else {
      const same = options.find(
        x => clean(x).toLowerCase() === clean(rawAnswer).toLowerCase()
      );
      correctAnswer = same || clean(rawAnswer);
    }

    return {
      id: q.id || ("PDF-" + Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 7)),
      text,
      question: text,
      options,
      correctAnswer,
      answer: correctAnswer,
      correctIndex: options.indexOf(correctAnswer),
      subject: q.subject || "Unknown",
      chapter: q.chapter || "",
      topic: q.topic || "",
      difficulty: q.difficulty || "Medium",
      marks: Number(q.marks) || 4,
      negativeMarks: Number(q.negativeMarks) || 1,
      explanation: q.explanation || q.solution || "",
      source: q.source || moduleName || "PDF Import",
      importedAt: new Date().toISOString()
    };
  }

  function parseBlocks(text) {
    text = clean(text);
    if (!text) return [];

    const result = [];

    /*
      Detect question starts anywhere in the flattened PDF text.
      Supports:
      1. / 1) / 1- / Q1. / Question 1.
    */
    const starts = [];
    const re = /(?:^|\s)(?:question\s*)?(\d{1,4})\s*[.)-]\s+/gi;

    let m;
    while ((m = re.exec(text))) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 2000) {
        starts.push({
          n,
          at: m.index + (m[0][0] === " " ? 1 : 0),
          content: re.lastIndex
        });
      }
    }

    for (let i = 0; i < starts.length; i++) {
      const a = starts[i];
      const b = starts[i + 1];
      const block = text.slice(a.content, b ? b.at : text.length).trim();

      if (!block) continue;

      /*
        Options:
        A. text
        A) text
        (A) text
        A- text
        1. text ... 4. text
      */
      const optRe =
        /(?:^|\s)(?:\(([A-D])\)|([A-D])|([1-4]))\s*[.)-]?\s+/gi;

      const matches = [...block.matchAll(optRe)];

      if (matches.length < 2) continue;

      const first = matches[0];
      const questionText = clean(block.slice(0, first.index));

      if (questionText.length < 5) continue;

      const options = [];

      for (let j = 0; j < matches.length && options.length < 4; j++) {
        const x = matches[j];
        const start = x.index + x[0].length;
        const end =
          j + 1 < matches.length
            ? matches[j + 1].index
            : block.length;

        let option = clean(block.slice(start, end));

        /*
          Strip answer markers accidentally captured in last option.
        */
        option = option.replace(
          /\s+(?:answer|ans|correct\s*answer)\s*[:.-]?\s*[A-D1-4]\s*$/i,
          ""
        );

        if (option) options.push(option);
      }

      if (options.length < 2) continue;

      const ansMatch = block.match(
        /(?:answer|ans|correct\s*answer)\s*[:.-]?\s*([A-D1-4])/i
      );

      result.push({
        text: questionText,
        options,
        correctAnswer: ansMatch ? ansMatch[1].toUpperCase() : "",
        subject: "Unknown"
      });
    }

    return result;
  }

  async function extractText(file) {
    if (!window.pdfjsLib) {
      throw new Error(
        "PDF.js is not loaded. Check vendor/pdf.min.js."
      );
    }

    const buffer = await file.arrayBuffer();

    const pdf = await window.pdfjsLib
      .getDocument({ data: buffer })
      .promise;

    let out = "";

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      const items = content.items || [];

      out += "\n" + items
        .map(x => x.str || "")
        .join(" ");
    }

    return out.trim();
  }

  async function ocrFallback(file, status) {
    if (!window.Tesseract) {
      return "";
    }

    try {
      const buffer = await file.arrayBuffer();

      if (!window.pdfjsLib) return "";

      const pdf = await window.pdfjsLib
        .getDocument({ data: buffer })
        .promise;

      let out = "";

      /*
        OCR only when PDF.js produced no useful text.
        First 30 pages prevents a huge scanned PDF from
        freezing a phone browser.
      */
      const pages = Math.min(pdf.numPages, 30);

      let worker = null;

      if (Tesseract.createWorker) {
        worker = await Tesseract.createWorker("eng");
      }

      for (let p = 1; p <= pages; p++) {
        status.textContent =
          "🔎 OCR page " + p + " / " + pages + "...";

        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1.7 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
          canvasContext: ctx,
          viewport
        }).promise;

        let r;

        if (worker) {
          r = await worker.recognize(canvas);
          out += "\n" + (r?.data?.text || "");
        } else if (Tesseract.recognize) {
          r = await Tesseract.recognize(canvas, "eng");
          out += "\n" + (r?.data?.text || "");
        }
      }

      if (worker && worker.terminate) {
        await worker.terminate();
      }

      return out.trim();
    } catch (e) {
      console.warn("OCR fallback failed:", e);
      return "";
    }
  }

  function merge(questions, moduleName, fileName) {
    const old = pool();

    const seen = new Set();

    old.forEach(q => {
      const signature =
        clean(q.text || q.question).toLowerCase() +
        "|" +
        (q.options || []).map(clean).join("|").toLowerCase();

      seen.add(signature);
    });

    let added = 0;
    let duplicates = 0;

    const fresh = [];

    questions.forEach((q, i) => {
      const n = normalize(q, i, moduleName);
      if (!n) return;

      const signature =
        clean(n.text).toLowerCase() +
        "|" +
        n.options.map(clean).join("|").toLowerCase();

      if (seen.has(signature)) {
        duplicates++;
        return;
      }

      seen.add(signature);
      fresh.push(n);
      added++;
    });

    const updated = old.concat(fresh);

    save(KEY, updated);

    const modules = read(META, []);
    modules.push({
      id: "module-" + Date.now(),
      name: moduleName,
      file: fileName,
      detected: questions.length,
      added,
      duplicates,
      totalPool: updated.length,
      importedAt: new Date().toISOString()
    });

    save(META, modules.slice(-200));

    return {
      detected: questions.length,
      added,
      duplicates,
      total: updated.length
    };
  }

  function render() {
    const p = pool();

    const total = $("totalQuestions");
    if (total) total.textContent = p.length;

    const counts = {
      physics: 0,
      chemistry: 0,
      biology: 0
    };

    p.forEach(q => {
      const s = clean(q.subject).toLowerCase();

      if (s.includes("physics")) counts.physics++;
      if (s.includes("chem")) counts.chemistry++;
      if (s.includes("bio")) counts.biology++;
    });

    if ($("physicsQuestions"))
      $("physicsQuestions").textContent = counts.physics;

    if ($("chemistryQuestions"))
      $("chemistryQuestions").textContent = counts.chemistry;

    if ($("biologyQuestions"))
      $("biologyQuestions").textContent = counts.biology;

    const preview = $("questionPreview");

    if (!preview) return;

    if (!p.length) {
      preview.textContent = "No questions in the PDF pool yet.";
      return;
    }

    preview.innerHTML = "";

    p.slice(0, 10).forEach((q, i) => {
      const box = document.createElement("div");
      box.style.cssText =
        "margin:10px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px";

      const title = document.createElement("div");
      title.innerHTML = "<strong>Q" + (i + 1) + ".</strong> ";

      const text = document.createElement("span");
      text.textContent = q.text || q.question || "";

      title.appendChild(text);
      box.appendChild(title);

      (q.options || []).forEach((o, j) => {
        const line = document.createElement("div");
        line.style.marginTop = "5px";
        line.textContent =
          String.fromCharCode(65 + j) + ") " + o;
        box.appendChild(line);
      });

      preview.appendChild(box);
    });

    if (p.length > 10) {
      const more = document.createElement("div");
      more.style.marginTop = "8px";
      more.textContent =
        "Showing first 10 of " + p.length + " questions.";
      preview.appendChild(more);
    }
  }

  function installUI() {
    const input = $("pdfInput");
    const convert = $("convertButton");
    const status = $("status");

    if (!input || !convert || !status) return;

    /*
      Allow repeated selection of the same PDF.
    */
    input.removeAttribute("multiple");

    /*
      Replace the button to remove previous parser click
      handlers without touching the rest of the page.
    */
    const freshButton = convert.cloneNode(true);
    convert.parentNode.replaceChild(freshButton, convert);

    freshButton.disabled = true;

    input.addEventListener("change", function () {
      const file = input.files && input.files[0];

      freshButton.disabled = !file;

      status.textContent = file
        ? "📄 Selected: " + file.name
        : "Select a PDF to begin.";
    });

    freshButton.addEventListener("click", async function () {
      const file = input.files && input.files[0];

      if (!file) return;

      const moduleInput = $("moduleName");

      const moduleName =
        clean(moduleInput && moduleInput.value) ||
        file.name.replace(/\.pdf$/i, "");

      freshButton.disabled = true;

      try {
        status.textContent =
          "⏳ Reading PDF with PDF.js...";

        let text = await extractText(file);

        /*
          OCR fallback for scanned/image PDFs.
        */
        if (text.length < 100) {
          status.textContent =
            "🖼️ Little/no text detected. Starting OCR...";

          const ocr = await ocrFallback(file, status);

          if (ocr.length > text.length) {
            text = ocr;
          }
        }

        if (!text || text.length < 20) {
          throw new Error(
            "No readable text could be extracted. This PDF may be protected, corrupted, or require an unsupported OCR language."
          );
        }

        status.textContent =
          "🧠 Detecting questions and options...";

        const raw = parseBlocks(text);

        if (!raw.length) {
          throw new Error(
            "PDF text was extracted, but no MCQ pattern with at least two options was detected."
          );
        }

        const result = merge(
          raw,
          moduleName,
          file.name
        );

        render();

        status.textContent =
          "✅ PDF → CBT COMPLETE\n\n" +
          "Module: " + moduleName + "\n" +
          "Questions detected: " + result.detected + "\n" +
          "New questions added: " + result.added + "\n" +
          "Duplicates skipped: " + result.duplicates + "\n" +
          "Total CBT pool: " + result.total;

        /*
          Create an explicit CBT launch button.
        */
        let launch = $("openPdfCBT");

        if (!launch) {
          launch = document.createElement("button");
          launch.id = "openPdfCBT";
          launch.type = "button";
          launch.className = "primary";
          launch.style.marginTop = "10px";
          launch.textContent = "🚀 Open PDF Questions in CBT";
          status.parentNode.appendChild(launch);
        }

        launch.onclick = function () {
          if (!pool().length) return;

          sessionStorage.setItem(
            "cbtSource",
            "PDF Import"
          );

          sessionStorage.setItem(
            "cbtQuestionCount",
            String(pool().length)
          );

          window.location.href =
            "./cbt.html?source=pdf";
        };

      } catch (e) {
        console.error("PDF FINAL ERROR:", e);

        status.textContent =
          "❌ Conversion failed\n\n" +
          e.message;
      } finally {
        freshButton.disabled = false;
      }
    });

    render();
  }

  window.PDFCBTFinal = {
    getPool: pool,
    render,
    parseBlocks,
    extractText
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installUI);
  } else {
    installUI();
  }
})();
