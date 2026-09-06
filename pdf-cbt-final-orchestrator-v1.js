(function () {
  "use strict";

  /*
    FINAL PDF → CBT ORCHESTRATOR
    Preserves existing parser.
    Adds a final safety/normalization layer.

    Requirements:
    - English only
    - Hindi/Devanagari removed
    - bilingual duplicate removal
    - exactly 4 usable options
    - no fixed question-count limit
    - fresh test id per PDF
    - old CBT active session cleared
    - answer-review queue preserved
    - UniversalPaper preserved when available
  */

  const POOL_KEY = "pdfCbtQuestions";
  const META_KEY = "pdfCbtImportMetaV3";
  const REVIEW_KEY = "pdfCbtReviewQueueV3";

  const ACTIVE_KEYS = [
    "CBT_ACTIVE_QUESTIONS",
    "CBT_ACTIVE_TEST",
    "CBT_ACTIVE_SOURCE",
    "CBT_ACTIVE_ANSWERS",
    "CBT_ACTIVE_SELECTED",
    "CBT_ACTIVE_CURRENT_INDEX"
  ];

  function clean(value) {
    return String(value ?? "")
      .replace(/[\u200B-\u200F\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/[\u0900-\u097F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function key(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function englishRatio(value) {
    const s = String(value ?? "");
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    const devanagari = (s.match(/[\u0900-\u097F]/g) || []).length;
    const total = latin + devanagari;
    return total ? latin / total : 0;
  }

  function englishText(value) {
    return clean(value)
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  }

  function normalizeOption(value) {
    return englishText(value)
      .replace(
        /^(?:\(?[A-Da-d1-4]\)?[\s.:)\-]+)+/,
        ""
      )
      .trim();
  }

  function isEnglishQuestion(q) {
    const question = englishText(
      q?.question ??
      q?.text ??
      q?.questionText ??
      q?.question_text ??
      ""
    );

    const options = Array.isArray(q?.options)
      ? q.options
      : Array.isArray(q?.choices)
        ? q.choices
        : [];

    if (question.length < 5) return false;

    const ratio = englishRatio(question);

    /*
      Allow scientific symbols/numbers, but require
      meaningful English text.
    */
    const words =
      question.match(/[A-Za-z]{2,}/g) || [];

    if (words.length === 0) return false;

    if (ratio < 0.50) {
      const combined = question + " " +
        options.join(" ");

      if (englishRatio(combined) < 0.65) {
        return false;
      }
    }

    return true;
  }

  function normalizeQuestion(q, index, testId, fileName) {
    if (!q || typeof q !== "object") return null;

    const question = englishText(
      q.question ??
      q.text ??
      q.questionText ??
      q.question_text ??
      ""
    );

    let options =
      Array.isArray(q.options)
        ? q.options.slice()
        : Array.isArray(q.choices)
          ? q.choices.slice()
          : [];

    options = options
      .map(normalizeOption)
      .filter(Boolean)
      .slice(0, 4);

    if (!isEnglishQuestion({
      ...q,
      question,
      options
    })) {
      return null;
    }

    if (options.length !== 4) return null;

    const uniqueOptions =
      new Set(options.map(key));

    if (uniqueOptions.size !== 4) return null;

    const normalized = {
      ...q,

      id:
        testId +
        "-q-" +
        (Number(q.number) || index + 1),

      number:
        Number(q.number) || index + 1,

      question,
      text: question,
      options,

      language: "English",

      source: q.source || "PDF",
      sourceFile:
        q.sourceFile ||
        q.fileName ||
        fileName,

      sourcePage:
        q.sourcePage ??
        q.page ??
        null,

      importedAt:
        q.importedAt ||
        new Date().toISOString(),

      needsReview:
        q.needsReview === true ||
        !q.correctAnswer,

      correctAnswer:
        q.correctAnswer ||
        q.correct_answer ||
        q.answer ||
        "",

      explanation:
        q.explanation || "",

      solution:
        q.solution || ""
    };

    normalized.correctIndex =
      normalized.correctAnswer &&
      /^[ABCD]$/i.test(
        normalized.correctAnswer
      )
        ? "ABCD".indexOf(
            normalized.correctAnswer.toUpperCase()
          )
        : -1;

    return normalized;
  }

  function dedupeQuestions(questions) {
    const seen = new Map();
    const output = [];

    for (const q of questions) {
      const k = key(q.question);

      if (!k) continue;

      if (!seen.has(k)) {
        seen.set(k, q);
        output.push(q);
        continue;
      }

      /*
        Prefer the version containing an answer.
      */
      const old = seen.get(k);

      if (
        old.needsReview &&
        !q.needsReview
      ) {
        const pos = output.indexOf(old);

        if (pos >= 0) {
          output[pos] = q;
        }

        seen.set(k, q);
      }
    }

    return output;
  }

  function clearActiveCBT() {
    for (const k of ACTIVE_KEYS) {
      try {
        sessionStorage.removeItem(k);
      } catch (_) {}

      try {
        localStorage.removeItem(k);
      } catch (_) {}
    }
  }

  function saveFinalPool(questions, fileName, testId) {
    const oldPool = (() => {
      try {
        const v =
          JSON.parse(
            localStorage.getItem(POOL_KEY) || "[]"
          );

        return Array.isArray(v) ? v : [];
      } catch (_) {
        return [];
      }
    })();

    /*
      Do not mix the newly imported PDF with an
      old active test. Keep imported pool records
      but tag this import independently.
    */
    const imported = questions.map(q => ({
      ...q,
      testId
    }));

    const combined = [
      ...oldPool.filter(
        q => q && q.testId !== testId
      ),
      ...imported
    ];

    localStorage.setItem(
      POOL_KEY,
      JSON.stringify(combined)
    );

    const review =
      imported.filter(
        q => q.needsReview
      );

    localStorage.setItem(
      REVIEW_KEY,
      JSON.stringify(review)
    );

    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        testId,
        title: fileName,
        fileName,
        source: "PDF",
        language: "English",
        questionCount: imported.length,
        reviewCount: review.length,
        importedAt: new Date().toISOString()
      })
    );

    return {
      imported,
      review
    };
  }

  function buildUniversalPaper(
    questions,
    fileName,
    testId
  ) {
    if (
      window.PDFCBTUniversalPaper &&
      typeof window.PDFCBTUniversalPaper.build ===
        "function"
    ) {
      try {
        return window.PDFCBTUniversalPaper.build(
          questions,
          {
            testId,
            fileName,
            importedAt:
              new Date().toISOString()
          }
        );
      } catch (e) {
        console.warn(
          "[FINAL PDF] UniversalPaper fallback:",
          e
        );
      }
    }

    return {
      schema: "UniversalPaper",
      schemaVersion: "1.0",

      meta: {
        testId,
        title: fileName,
        fileName,
        source: "PDF",
        language: "English",
        questionCount: questions.length,
        reviewCount:
          questions.filter(q => q.needsReview).length,
        importedAt:
          new Date().toISOString()
      },

      sections: [
        {
          id: "main",
          title: "Imported PDF",
          questions
        }
      ],

      questions
    };
  }

  function finalNormalize(
    questions,
    fileName
  ) {
    const testId =
      "pdf-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 9);

    const normalized = [];

    for (
      let i = 0;
      i < (
        Array.isArray(questions)
          ? questions.length
          : 0
      );
      i++
    ) {
      const q =
        normalizeQuestion(
          questions[i],
          i,
          testId,
          fileName
        );

      if (q) {
        normalized.push(q);
      }
    }

    const unique =
      dedupeQuestions(normalized);

    const finalQuestions =
      unique.map((q, i) => ({
        ...q,
        sequence: i + 1,
        testId
      }));

    return {
      testId,
      questions: finalQuestions
    };
  }

  /*
    Public API for the existing converter.
  */
  window.PDFCBTFinal = {
    finalNormalize,
    buildUniversalPaper,
    saveFinalPool,
    clearActiveCBT
  };

  /*
    Final safety hook:
    whenever the converter finishes and writes
    pdfCbtQuestions, normalize the pool once.
  */
  function observePool() {
    let last = "";

    setInterval(() => {
      let raw = "";

      try {
        raw =
          localStorage.getItem(POOL_KEY) || "";
      } catch (_) {
        return;
      }

      if (!raw || raw === last) return;

      last = raw;

      let pool;

      try {
        pool = JSON.parse(raw);
      } catch (_) {
        return;
      }

      if (!Array.isArray(pool) || !pool.length) {
        return;
      }

      /*
        Only repair records that look like imported
        PDF questions. Never touch unrelated data.
      */
      const pdfQuestions =
        pool.filter(q =>
          q &&
          (
            q.source === "PDF" ||
            q.source === "Institute Test PDF" ||
            q.sourceFile ||
            q.testId
          )
        );

      if (!pdfQuestions.length) return;

      const fileName =
        pdfQuestions[0].sourceFile ||
        pdfQuestions[0].fileName ||
        "Imported PDF";

      const result =
        finalNormalize(
          pdfQuestions,
          fileName
        );

      if (!result.questions.length) {
        return;
      }

      /*
        Preserve non-PDF records.
      */
      const nonPdf =
        pool.filter(
          q => !pdfQuestions.includes(q)
        );

      const finalPool = [
        ...nonPdf,
        ...result.questions
      ];

      try {
        localStorage.setItem(
          POOL_KEY,
          JSON.stringify(finalPool)
        );

        const review =
          result.questions.filter(
            q => q.needsReview
          );

        localStorage.setItem(
          REVIEW_KEY,
          JSON.stringify(review)
        );

        localStorage.setItem(
          META_KEY,
          JSON.stringify({
            testId: result.testId,
            title: fileName,
            fileName,
            source: "PDF",
            language: "English",
            questionCount:
              result.questions.length,
            reviewCount: review.length,
            importedAt:
              new Date().toISOString()
          })
        );
      } catch (e) {
        console.error(
          "[FINAL PDF] save error:",
          e
        );
      }
    }, 1200);
  }

  /*
    Clear stale active CBT state when a new PDF
    is selected. This prevents the previous PDF's
    questions from appearing in the next CBT.
  */
  function installFreshPDFIsolation() {
    const input =
      document.getElementById("pdfInput");

    if (!input) return;

    input.addEventListener(
      "change",
      function () {
        if (input.files && input.files.length) {
          clearActiveCBT();

          try {
            sessionStorage.setItem(
              "CBT_ACTIVE_SOURCE",
              "PDF Import"
            );
          } catch (_) {}
        }
      },
      true
    );
  }


  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installFreshPDFIsolation
    );
  } else {
    installFreshPDFIsolation();
  }

})();
