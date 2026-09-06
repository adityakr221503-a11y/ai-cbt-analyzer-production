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

/* =====================================================
   FINAL PDF FIX V2
   VERIFIED AGAINST CURRENT ab37691 CODE

   Fixes:
   1. Old PDF questions never preview on initial load.
   2. New PDF replaces current PDF CBT pool.
   3. Legacy Hindi-font encoded text is removed.
   4. English-only 4-option questions are retained.
   5. Existing Universal parser/OCR remains preserved.
   6. Reference-style question boundary parsing is used.
===================================================== */

(function () {
  "use strict";

  const POOL = "pdfCbtQuestions";
  const META = "pdfCbtImportMetaV3";
  const REVIEW = "pdfCbtReviewQueueV3";

  const legacyHindiWords = new Set([
    "ds","dk","dks","ij","ls","ugha","ug",
    "gksxk","gSa","gS","fLFkfr","foHko",
    "vkos'k","rFkk","nksuksa","nks","lek{kh;",
    "NYys","irys","f=T;k","nwljs","j[krs",
    "pkyd","lEiw.kZ","LFkkukUrfjr","ugh",
    "fd;k","ldr","foHkokUrj","dkj.k",
    "esa","v",",d","dsUæ","foyfxr"
  ]);

  function cleanLegacyHindi(value) {
    let s = String(value ?? "")
      .replace(/[\u0900-\u097F]/g, " ")
      .replace(/[\u200B-\u200F\uFEFF]/g, " ");

    const parts = s.split(/(\s+)/);

    s = parts.map(function (part) {
      const t = part.trim();

      if (!t) return part;

      if (legacyHindiWords.has(t)) {
        return " ";
      }

      /* Strong legacy-font signatures */
      if (
        /[{}]/.test(t) &&
        /[A-Za-z]/.test(t)
      ) {
        return " ";
      }

      if (
        /[=;]/.test(t) &&
        /[A-Za-z]/.test(t)
      ) {
        return " ";
      }

      const legacyHindiPrefix =
        ["vk","fo","fL","LF","lE","nwl","dks","ds","ij","ls","ug","gks","rFkk"]
          .some(prefix => t.toLowerCase().startsWith(prefix.toLowerCase()));

      if (
        legacyHindiPrefix &&
        t.length <= 14 &&
        !/^(?:focus|from|for|left|right|large|small|glass|this)$/i.test(t)
      ) {
        return " ";
      }

      return part;
    }).join("");

    return s
      .replace(/\s+/g, " ")
      .trim();
  }

  function englishQuality(text) {
    const s = String(text ?? "");

    const latin =
      (s.match(/[A-Za-z]/g) || []).length;

    const dev =
      (s.match(/[\u0900-\u097F]/g) || []).length;

    const words =
      (s.match(/[A-Za-z]{2,}/g) || []).length;

    if (!words) return 0;

    if (dev > 0) {
      return latin / Math.max(1, latin + dev);
    }

    return Math.min(
      1,
      words / Math.max(1, s.split(/\s+/).length)
    );
  }

  function cleanQuestion(q) {
    if (!q) return null;

    const question =
      cleanLegacyHindi(
        q.question ||
        q.text ||
        ""
      );

    const options =
      (Array.isArray(q.options)
        ? q.options
        : []
      )
        .map(cleanLegacyHindi)
        .map(function (x) {
          return x
            .replace(
              /^(?:\(?[A-D1-4]\)?[.):\-]\s*)+/i,
              ""
            )
            .trim();
        })
        .filter(Boolean);

    if (question.length < 5) {
      return null;
    }

    if (options.length !== 4) {
      return null;
    }

    if (englishQuality(question) < 0.45) {
      return null;
    }

    if (
      options.some(function (o) {
        return englishQuality(o) < 0.35;
      })
    ) {
      return null;
    }

    const unique =
      new Set(
        options.map(function (o) {
          return o
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
        })
      );

    if (unique.size !== 4) {
      return null;
    }

    return {
      ...q,
      question,
      text: question,
      options,
      language: "English"
    };
  }

  function dedupeFresh(list) {
    const seen = new Set();
    const result = [];

    for (const q of list) {
      const cleaned = cleanQuestion(q);

      if (!cleaned) continue;

      const k =
        cleaned.question
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      if (!k || seen.has(k)) continue;

      seen.add(k);
      result.push(cleaned);
    }

    return result;
  }

  /*
   * Reference-style pattern boundary parser.
   * Question number = start signal.
   * Next question number = end signal.
   * A-D = option boundaries.
   */
  function parseReferencePages(pages) {
    const groups = [];

    for (const page of Array.isArray(pages)
      ? pages
      : []) {

      const lines =
        Array.isArray(page.lines)
          ? page.lines
          : [];

      let current = null;

      for (const raw of lines) {
        const line =
          String(raw ?? "").trim();

        if (!line) continue;

        const q =
          line.match(
            /^(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[.):\-]\s*(.*)$/i
          );

        if (q) {
          if (current) {
            groups.push(current);
          }

          current = {
            number: Number(q[1]),
            page: page.page,
            lines: q[2]
              ? [q[2]]
              : []
          };

          continue;
        }

        if (current) {
          current.lines.push(line);
        }
      }

      if (current) {
        groups.push(current);
      }
    }

    const questions = [];

    for (const group of groups) {
      const stem = [];
      const options = [];
      let currentOption = null;

      for (const raw of group.lines) {
        const line =
          cleanLegacyHindi(raw);

        if (!line) continue;

        const opt =
          line.match(
            /^(?:\(([A-D1-4])\)|([A-D1-4])\s*[.):\-])\s*(.+)$/i
          );

        if (opt) {
          const letter =
            String(
              opt[1] || opt[2]
            ).toUpperCase();

          const text =
            cleanLegacyHindi(opt[3]);

          if (
            text &&
            !options.some(
              o => o.letter === letter
            )
          ) {
            currentOption = {
              letter,
              text
            };

            options.push(
              currentOption
            );
          }

          continue;
        }

        if (currentOption) {
          currentOption.text =
            cleanLegacyHindi(
              currentOption.text +
              " " +
              line
            );
        } else {
          stem.push(line);
        }
      }

      options.sort(
        (a, b) =>
          "ABCD".indexOf(a.letter) -
          "ABCD".indexOf(b.letter)
      );

      if (options.length !== 4) {
        continue;
      }

      const question =
        cleanLegacyHindi(
          stem.join(" ")
        );

      const cleaned =
        cleanQuestion({
          id:
            "PDF-FINAL-" +
            Date.now() +
            "-" +
            questions.length,

          number:
            group.number,

          question,
          text: question,

          options:
            options.map(
              o => o.text
            ),

          source:
            "Institute Test PDF",

          sourcePage:
            group.page,

          correctAnswer: "",
          needsReview: true
        });

      if (cleaned) {
        questions.push(cleaned);
      }
    }

    return dedupeFresh(
      questions
    );
  }

  function saveFreshPDF(
    questions,
    fileName
  ) {
    const testId =
      "pdf-test-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 9);

    const importedAt =
      new Date().toISOString();

    const fresh =
      dedupeFresh(
        questions
      ).map(function (q, i) {
        return {
          ...q,

          id:
            testId +
            "-q-" +
            (i + 1),

          sequence:
            i + 1,

          importedTestId:
            testId,

          source:
            "Institute Test PDF",

          sourceFile:
            fileName,

          language:
            "English",

          importedAt
        };
      });

    if (!fresh.length) {
      throw new Error(
        "No valid English questions found."
      );
    }

    const review =
      fresh.filter(
        q => q.needsReview
      );

    /*
     * IMPORTANT:
     * New PDF replaces old PDF pool.
     */
    localStorage.setItem(
      POOL,
      JSON.stringify(fresh)
    );

    localStorage.setItem(
      REVIEW,
      JSON.stringify(review)
    );

    localStorage.setItem(
      META,
      JSON.stringify({
        version:
          "pdf-cbt-final-v2",

        testId,

        fileName,

        language:
          "English",

        questionCount:
          fresh.length,

        reviewCount:
          review.length,

        importedAt
      })
    );

    /*
     * Clear transient CBT state.
     * History/mastery/mistakes/retry untouched.
     */
    [
      "CBT_ACTIVE_QUESTIONS",
      "CBT_ACTIVE_TEST",
      "CBT_ACTIVE_SOURCE",
      "CBT_ACTIVE_TEST_ID",
      "CBT_ACTIVE_ANSWERS",
      "CBT_ACTIVE_SELECTED",
      "CBT_ACTIVE_CURRENT_INDEX"
    ].forEach(function (key) {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    });

    const test = {
      id: testId,

      title: fileName,

      duration: 180,

      questions: fresh,

      questionIds:
        fresh.map(
          q => q.id
        ),

      totalQuestions:
        fresh.length,

      source:
        "Institute Test PDF",

      sourceFile:
        fileName,

      language:
        "English",

      importedAt
    };

    sessionStorage.setItem(
      "CBT_ACTIVE_QUESTIONS",
      JSON.stringify(fresh)
    );

    sessionStorage.setItem(
      "CBT_ACTIVE_TEST",
      JSON.stringify(test)
    );

    sessionStorage.setItem(
      "CBT_ACTIVE_SOURCE",
      "PDF"
    );

    sessionStorage.setItem(
      "CBT_ACTIVE_TEST_ID",
      testId
    );

    return fresh;
  }

  function showFinalPreview(
    questions
  ) {
    const box =
      document.getElementById(
        "questionPreview"
      );

    if (!box) return;

    box.innerHTML =
      questions
        .slice(0, 5)
        .map(function (q, i) {
          return (
            "<div style=\"margin:10px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px\">" +
            "<strong>Q" +
            (i + 1) +
            ".</strong> " +
            String(q.question)
              .replace(/</g, "&lt;") +
            "<br><small>" +
            q.options
              .map(function (o, j) {
                return (
                  String.fromCharCode(
                    65 + j
                  ) +
                  ") " +
                  String(o)
                    .replace(
                      /</g,
                      "&lt;"
                    )
                );
              })
              .join(" &nbsp; ") +
            "</small></div>"
          );
        })
        .join("") +
      (
        questions.length > 5
          ? "<div>Showing first 5 of " +
            questions.length +
            " questions.</div>"
          : ""
      );
  }

  async function finalConvert(
    file
  ) {
    const parser =
      window.PDFCBTUniversalV1;

    if (!parser) {
      throw new Error(
        "Universal PDF parser is not loaded."
      );
    }

    const moduleInput =
      document.getElementById(
        "moduleName"
      );

    const status =
      document.getElementById(
        "status"
      );

    const fileName =
      (
        moduleInput?.value ||
        file.name
      ).trim() ||
      file.name;

    if (status) {
      status.textContent =
        "Reading PDF text layer…";
    }

    let pages = [];

    try {
      pages =
        await parser.extractTextPages(
          file
        );
    } catch (e) {
      console.warn(
        "[PDF FINAL] text layer failed",
        e
      );
    }

    let questions =
      parseReferencePages(
        pages
      );

    /*
     * Preserve OCR as fallback.
     */
    if (!questions.length) {
      if (status) {
        status.textContent =
          "Trying OCR fallback…";
      }

      try {
        const ocrPages =
          await parser.ocrPages(
            file
          );

        questions =
          parseReferencePages(
            ocrPages
          );
      } catch (e) {
        console.warn(
          "[PDF FINAL] OCR fallback failed",
          e
        );
      }
    }

    if (!questions.length) {
      throw new Error(
        "No complete English 4-option questions could be safely reconstructed."
      );
    }

    const fresh =
      saveFreshPDF(
        questions,
        fileName
      );

    showFinalPreview(
      fresh
    );

    const review =
      fresh.filter(
        q => q.needsReview
      ).length;

    if (status) {
      status.textContent =
        "✅ Test PDF ready\n\n" +
        "File: " +
        fileName +
        "\n" +
        "Valid questions: " +
        fresh.length +
        "\n" +
        "Needs answer review: " +
        review +
        "\n\n" +
        "No fixed question-count limit. Ready for CBT.";
    }

    document.dispatchEvent(
      new CustomEvent(
        "pdfCbtPoolUpdated",
        {
          detail: {
            questions: fresh
          }
        }
      )
    );

    return fresh;
  }

  function clearOldPreview() {
    const box =
      document.getElementById(
        "questionPreview"
      );

    if (box) {
      box.textContent =
        "No questions from a new PDF yet. Select a PDF and convert it.";
    }
  }

  function installFinalGate() {
    const button =
      document.getElementById(
        "convertButton"
      );

    const input =
      document.getElementById(
        "pdfInput"
      );

    if (!button || !input) {
      return;
    }

    /*
     * Window capture runs before the
     * old button handlers, so the old
     * parser cannot also process the PDF.
     */
    window.addEventListener(
      "click",
      function (event) {
        if (
          event.target !== button
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const file =
          input.files &&
          input.files[0];

        if (!file) {
          const status =
            document.getElementById(
              "status"
            );

          if (status) {
            status.textContent =
              "Select a PDF first.";
          }

          return;
        }

        button.disabled = true;

        finalConvert(file)
          .catch(function (error) {
            console.error(
              "[PDF FINAL]",
              error
            );

            const status =
              document.getElementById(
                "status"
              );

            if (status) {
              status.textContent =
                "❌ Conversion failed\n\n" +
                (
                  error.message ||
                  "Unknown error"
                );
            }
          })
          .finally(function () {
            button.disabled = false;
          });
      },
      true
    );
  }

  function boot() {
    /*
     * Critical fix:
     * never show old localStorage questions
     * just because page opened.
     */
    clearOldPreview();

    installFinalGate();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

})();
