(function () {
  "use strict";

  const ACTIVE_KEY = "CBT_ACTIVE_TEST";
  const SOURCE_KEY = "CBT_ACTIVE_SOURCE";
  const PDF_KEY = "pdfCbtQuestions";
  const LIBRARY_KEYS = [
    "pcbUnifiedTestLibrary",
    "unifiedTestLibrary",
    "CBT_TEST_LIBRARY"
  ];

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getLibrary() {
    for (const key of LIBRARY_KEYS) {
      const value = readJSON(key, null);
      if (Array.isArray(value)) return { key, value };
      if (value && Array.isArray(value.tests)) {
        return { key, value: value.tests };
      }
    }

    return {
      key: LIBRARY_KEYS[0],
      value: []
    };
  }

  function normalizeQuestion(q, index) {
    if (
      window.PCBUniversalPDFParser &&
      typeof window.PCBUniversalPDFParser.normalizeQuestion === "function"
    ) {
      return window.PCBUniversalPDFParser.normalizeQuestion(q, index);
    }

    const question = String(
      q && (
        q.question ||
        q.questionText ||
        q.text
      ) || ""
    ).trim();

    const options = Array.isArray(q && q.options)
      ? q.options.map(x => String(x || "").trim()).filter(Boolean)
      : [];

    if (!question || options.length < 2) return null;

    return {
      id: q.id || "pdf-" + Date.now() + "-" + index,
      question,
      options,
      correctAnswer:
        q.correctAnswer ??
        q.answer ??
        "",
      answer:
        q.answer ??
        q.correctAnswer ??
        "",
      solution:
        q.solution ||
        q.explanation ||
        "",
      subject: q.subject || "General",
      chapter: q.chapter || "",
      source: "PDF Import",
      sourceType: "pdf"
    };
  }

  function normalizeQuestions(input) {
    let raw = input;

    if (raw && Array.isArray(raw.questions)) {
      raw = raw.questions;
    }

    if (raw && Array.isArray(raw.items)) {
      raw = raw.items;
    }

    if (!Array.isArray(raw)) return [];

    const seen = new Set();
    const output = [];

    raw.forEach(function (q, i) {
      const normalized = normalizeQuestion(q, i);

      if (!normalized) return;

      const key = String(normalized.question)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      if (!key || seen.has(key)) return;

      seen.add(key);
      output.push(normalized);
    });

    return output;
  }

  function registerTest(questions, meta) {
    if (!questions.length) {
      throw new Error(
        "PDF conversion produced 0 usable questions."
      );
    }

    const id =
      "pdf-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8);

    const fileName =
      meta.fileName ||
      "Imported PDF";

    const title =
      meta.title ||
      fileName.replace(/\.pdf$/i, "") ||
      "PDF Test";

    const test = {
      id,
      testId: id,
      title,
      name: title,
      source: "PDF Import",
      sourceType: "pdf",
      fileName,
      createdAt: new Date().toISOString(),
      questionCount: questions.length,
      questions,
      nichod: {
        enabled: true,
        source: "PDF",
        pipeline: "live-import-bridge"
      }
    };

    /* Authoritative active session */
    writeJSON(ACTIVE_KEY, test);

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

    /* Preserve the legacy CBT PDF key */
    writeJSON(
      PDF_KEY,
      questions
    );

    /* Unified library */
    const library = getLibrary();

    const withoutSameId =
      library.value.filter(
        t => !t || t.id !== id
      );

    withoutSameId.unshift(test);

    const oldValue = readJSON(
      library.key,
      null
    );

    if (
      oldValue &&
      !Array.isArray(oldValue) &&
      Array.isArray(oldValue.tests)
    ) {
      oldValue.tests = withoutSameId;
      writeJSON(library.key, oldValue);
    } else {
      writeJSON(
        library.key,
        withoutSameId
      );
    }

    /* Compatibility keys used by existing library code */
    writeJSON(
      "CBT_LAST_CREATED_TEST",
      test
    );

    writeJSON(
      "CBT_SELECTED_TEST",
      test
    );

    window.dispatchEvent(
      new CustomEvent(
        "PCB_PDF_TEST_READY",
        {
          detail: test
        }
      )
    );

    return test;
  }

  function openCBT(test) {
    const encoded =
      encodeURIComponent(test.id);

    const url =
      "./cbt.html?source=pdf&test=" +
      encoded;

    window.location.href = url;
  }

  async function importQuestions(
    questions,
    meta
  ) {
    const normalized =
      normalizeQuestions(
        questions
      );

    if (!normalized.length) {
      throw new Error(
        "No valid MCQ questions were detected. No fallback/demo questions were loaded."
      );
    }

    const test =
      registerTest(
        normalized,
        meta || {}
      );

    openCBT(test);

    return test;
  }

  async function importPDF(
    pdfData,
    fileName
  ) {
    if (
      !window.PCBUniversalPDFParser ||
      typeof window.PCBUniversalPDFParser.parsePdfDocument !== "function"
    ) {
      throw new Error(
        "Universal PDF parser is not loaded."
      );
    }

    const result =
      await window.PCBUniversalPDFParser
        .parsePdfDocument(
          pdfData,
          fileName
        );

    if (
      !result ||
      !result.test ||
      !Array.isArray(
        result.test.questions
      )
    ) {
      throw new Error(
        "PDF parser returned an invalid test."
      );
    }

    const questions =
      normalizeQuestions(
        result.test.questions
      );

    if (!questions.length) {
      throw new Error(
        "No usable questions were produced from this PDF."
      );
    }

    const test =
      registerTest(
        questions,
        {
          fileName,
          title:
            result.test.title
        }
      );

    openCBT(test);

    return test;
  }

  function exposeButton() {
    const candidates = [
      "convertBtn",
      "convert",
      "convertButton",
      "parsePdf",
      "parsePDF",
      "startConversion",
      "startConvert",
      "generateCBT",
      "createCBT",
      "pdfToCbt",
      "pdfToCBT"
    ];

    for (const id of candidates) {
      const button =
        document.getElementById(id);

      if (!button) continue;

      if (
        button.dataset
          .pcbPdfLiveBridge === "1"
      ) {
        continue;
      }

      button.dataset
        .pcbPdfLiveBridge = "1";

      button.addEventListener(
        "pcb:convert",
        async function (event) {
          try {
            const detail =
              event.detail || {};

            if (
              detail.questions
            ) {
              await importQuestions(
                detail.questions,
                detail
              );
            }
          } catch (error) {
            console.error(
              "[PCB PDF LIVE]",
              error
            );

            alert(
              "PDF → CBT failed: " +
              error.message
            );
          }
        }
      );
    }
  }

  window.PCBPDFLiveImportBridge = {
    normalizeQuestions,
    registerTest,
    importQuestions,
    importPDF,
    openCBT
  };

  document.addEventListener(
    "DOMContentLoaded",
    exposeButton
  );

  window.addEventListener(
    "PCB_PDF_QUESTIONS_READY",
    async function (event) {
      const detail =
        event.detail || {};

      if (
        !detail.questions
      ) {
        return;
      }

      try {
        await importQuestions(
          detail.questions,
          detail
        );
      } catch (error) {
        console.error(
          "[PCB PDF LIVE]",
          error
        );
      }
    }
  );

})();
