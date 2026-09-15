(function () {
  "use strict";

  const STORAGE = {
    PDF: "pdfCbtQuestions",
    ACTIVE: "CBT_ACTIVE_TEST",
    SOURCE: "CBT_ACTIVE_SOURCE"
  };

  function clean(v) {
    return String(v || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function answerIndex(v) {
    const m = String(v || "")
      .trim()
      .toUpperCase()
      .match(/^(?:OPTION\s*)?([A-D])$/);

    return m ? "ABCD".indexOf(m[1]) : -1;
  }

  function normalizeQuestion(q, index) {
    if (!q) return null;

    const text = clean(
      q.question ||
      q.questionText ||
      q.text ||
      q.q
    );

    let options = Array.isArray(q.options)
      ? q.options
          .map(clean)
          .filter(Boolean)
          .slice(0, 4)
      : [];

    if (!text || options.length < 2) {
      return null;
    }

    const answer =
      q.correctAnswer ||
      q.answer ||
      q.correct_option ||
      q.correctOption ||
      "";

    return {
      id:
        q.id ||
        "pdf-" +
        Date.now() +
        "-" +
        index,

      question: text,

      options,

      correctAnswer:
        typeof answer === "number"
          ? answer
          : answerIndex(answer) >= 0
            ? answerIndex(answer)
            : answer,

      answer:
        q.answer || answer || "",

      solution:
        clean(
          q.solution ||
          q.explanation ||
          q.explain ||
          ""
        ),

      subject:
        clean(q.subject || "General"),

      chapter:
        clean(q.chapter || ""),

      source:
        "PDF Import",

      sourceType:
        "pdf"
    };
  }

  function parseBlocks(text) {
    text = String(text || "")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ");

    const lines = text
      .split("\n")
      .map(clean)
      .filter(Boolean);

    const questions = [];
    let current = null;

    const qStart =
      /^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[\)\.:\-]\s*(.+)$/i;

    const optionStart =
      /^\(?([A-D])\)?[\.\):\-]\s*(.+)$/i;

    function flush() {
      if (!current) return;

      const q = normalizeQuestion(
        current,
        questions.length
      );

      if (q) questions.push(q);

      current = null;
    }

    for (const line of lines) {
      const qm = line.match(qStart);

      if (qm) {
        flush();

        current = {
          question: qm[2],
          options: []
        };

        continue;
      }

      const om = line.match(optionStart);

      if (om && current) {
        current.options.push(
          clean(om[2])
        );

        continue;
      }

      if (current) {
        if (
          current.options.length
        ) {
          const i =
            current.options.length - 1;

          current.options[i] =
            clean(
              current.options[i] +
              " " +
              line
            );
        } else {
          current.question =
            clean(
              current.question +
              " " +
              line
            );
        }
      }
    }

    flush();

    return questions;
  }

  function parseNumberedLoose(text) {
    const matches = String(text || "")
      .split(/(?=\b\d{1,3}[\.\)]\s+)/)
      .map(clean)
      .filter(Boolean);

    const result = [];

    for (const block of matches) {
      const lines = block
        .split("\n")
        .map(clean)
        .filter(Boolean);

      if (!lines.length) continue;

      const joined = lines.join("\n");

      const q = parseBlocks(joined);

      if (q.length) {
        result.push.apply(result, q);
      }
    }

    return result;
  }

  function dedupe(list) {
    const seen = new Set();
    const out = [];

    for (const q of list) {
      const key = clean(q.question)
        .toLowerCase()
        .replace(/\s+/g, " ");

      if (!key || seen.has(key)) continue;

      seen.add(key);
      out.push(q);
    }

    return out.map(function (q, i) {
      q.id =
        q.id ||
        "pdf-" +
        Date.now() +
        "-" +
        i;

      return q;
    });
  }

  function createTest(questions, meta) {
    const id =
      "PDF-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8);

    const test = {
      id,

      testId: id,

      title:
        meta.title ||
        "PDF Test " +
        new Date().toLocaleString(),

      name:
        meta.title ||
        "PDF Test",

      source:
        "PDF Import",

      sourceType:
        "pdf",

      fileName:
        meta.fileName || "",

      createdAt:
        new Date().toISOString(),

      questions,

      questionCount:
        questions.length,

      nichod: {
        enabled: true,
        source: "PDF",
        version: "universal-parser-v1"
      }
    };

    localStorage.setItem(
      STORAGE.PDF,
      JSON.stringify(questions)
    );

    localStorage.setItem(
      STORAGE.ACTIVE,
      JSON.stringify(test)
    );

    localStorage.setItem(
      STORAGE.SOURCE,
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
      meta.fileName || ""
    );

    window.dispatchEvent(
      new CustomEvent(
        "PCB_PDF_TEST_CREATED",
        {
          detail: test
        }
      )
    );

    return test;
  }

  async function parsePdfDocument(
    pdf,
    fileName
  ) {
    if (
      !window.pdfjsLib ||
      !pdfjsLib.getDocument
    ) {
      throw new Error(
        "PDF.js is not available"
      );
    }

    const loadingTask =
      pdfjsLib.getDocument({
        data: pdf
      });

    const document =
      await loadingTask.promise;

    const pages = [];

    for (
      let i = 1;
      i <= document.numPages;
      i++
    ) {
      const page =
        await document.getPage(i);

      const content =
        await page.getTextContent();

      const text =
        content.items
          .map(x => x.str || "")
          .join(" ");

      pages.push(text);
    }

    const fullText =
      pages.join("\n");

    let questions =
      parseBlocks(fullText);

    if (
      questions.length === 0
    ) {
      questions =
        parseNumberedLoose(
          fullText
        );
    }

    questions =
      dedupe(questions);

    if (!questions.length) {
      throw new Error(
        "No MCQ questions could be detected from this PDF. The PDF may require OCR."
      );
    }

    const test =
      createTest(
        questions,
        {
          fileName:
            fileName || "PDF",

          title:
            fileName
              ? fileName.replace(
                  /\.pdf$/i,
                  ""
                )
              : "PDF Test"
        }
      );

    return {
      success: true,

      test,

      questionCount:
        questions.length,

      pages:
        document.numPages
    };
  }

  window.PCBUniversalPDFParser = {
    parsePdfDocument,
    parseBlocks,
    normalizeQuestion
  };

})();
