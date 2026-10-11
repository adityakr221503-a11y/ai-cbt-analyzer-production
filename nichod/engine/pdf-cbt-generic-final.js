(function () {
  "use strict";

  const TARGET = "pdfCbtQuestions";

  function clean(s) {
    return String(s || "")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function answerIndex(x) {
    if (x == null) return null;

    const s = String(x).trim().toUpperCase();

    if (/^[0-3]$/.test(s))
      return Number(s);

    const m = s.match(/(?:OPTION\s*)?([ABCD])/);

    if (!m) return null;

    return {
      A: 0,
      B: 1,
      C: 2,
      D: 3
    }[m[1]];
  }

  function normalize(q, index) {

    if (!q || typeof q !== "object")
      return null;

    const text = clean(
      q.question ||
      q.questionText ||
      q.text ||
      q.q
    );

    if (text.length < 5)
      return null;

    let options = Array.isArray(q.options)
      ? q.options
      : [
          q.option1,
          q.option2,
          q.option3,
          q.option4
        ].filter(Boolean);

    options = options
      .map(clean)
      .filter(Boolean)
      .slice(0, 4);

    if (options.length < 2)
      return null;

    const correct =
      answerIndex(
        q.correctAnswer ??
        q.answer ??
        q.correct
      );

    return {
      id:
        q.id ||
        "pdf-generic-" + index,

      question: text,

      options,

      correctAnswer:
        correct,

      answer:
        correct,

      source:
        "PDF Import",

      importedFromPDF: true,

      nichodEligible: true
    };
  }

  function parseText(text) {

    text = clean(text);

    if (!text)
      return [];

    /*
     * Supports common formats:
     *
     * 1. Question
     * A. option
     * B. option
     * C. option
     * D. option
     *
     * 1) Question
     * (A) option
     * ...
     *
     * Question numbers can also be 01, 001 etc.
     */

    const lines = text
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean);

    const result = [];

    let current = null;

    function flush() {

      if (!current)
        return;

      const q =
        normalize(
          {
            question:
              current.question.join(" "),

            options:
              current.options
          },
          result.length
        );

      if (q)
        result.push(q);

      current = null;
    }

    for (const line of lines) {

      const questionMatch =
        line.match(
          /^(?:Q(?:uestion)?\s*)?(\d{1,4})\s*[\.\):\-]\s*(.+)$/i
        );

      const optionMatch =
        line.match(
          /^\(?([A-D])\)?[\.\):\-]\s*(.+)$/i
        );

      if (questionMatch) {

        flush();

        current = {
          question: [
            questionMatch[2]
          ],

          options: []
        };

        continue;
      }

      if (optionMatch && current) {

        current.options.push(
          optionMatch[2]
        );

        continue;
      }

      if (current) {

        if (
          current.options.length === 0
        ) {
          current.question.push(line);
        } else {

          const last =
            current.options.length - 1;

          current.options[last] +=
            " " + line;
        }
      }
    }

    flush();

    return result;
  }

  function dedupe(list) {

    const seen = new Set();

    return list.filter(q => {

      const key =
        q.question
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      if (seen.has(key))
        return false;

      seen.add(key);
      return true;
    });
  }

  function save(questions) {

    questions =
      dedupe(
        questions
          .map(normalize)
          .filter(Boolean)
      );

    if (!questions.length) {

      localStorage.removeItem(TARGET);

      localStorage.setItem(
        "PCB_PDF_GENERIC_STATUS",
        JSON.stringify({
          status: "PARSE_FAILED",
          count: 0,
          timestamp: Date.now(),
          message:
            "No valid MCQ structure detected. No fallback questions used."
        })
      );

      return 0;
    }

    localStorage.setItem(
      TARGET,
      JSON.stringify(questions)
    );

    localStorage.setItem(
      "CBT_ACTIVE_SOURCE",
      "PDF Import"
    );

    localStorage.setItem(
      "PCB_PDF_GENERIC_STATUS",
      JSON.stringify({
        status: "SUCCESS",
        count: questions.length,
        timestamp: Date.now()
      })
    );

    return questions.length;
  }

  async function extract(file) {

    if (!window.pdfjsLib)
      throw new Error(
        "PDF.js is not loaded."
      );

    const buffer =
      await file.arrayBuffer();

    const pdf =
      await pdfjsLib
        .getDocument({
          data: buffer
        })
        .promise;

    let text = "";

    for (
      let pageNo = 1;
      pageNo <= pdf.numPages;
      pageNo++
    ) {

      const page =
        await pdf.getPage(pageNo);

      const content =
        await page.getTextContent();

      const pageText =
        content.items
          .map(x => x.str || "")
          .join(" ");

      text +=
        "\n" +
        pageText +
        "\n";
    }

    return {
      pages: pdf.numPages,
      text: clean(text)
    };
  }

  async function process(file) {

    const started =
      Date.now();

    try {

      const extracted =
        await extract(file);

      const questions =
        parseText(
          extracted.text
        );

      const count =
        save(questions);

      const report = {
        status:
          count > 0
            ? "SUCCESS"
            : "PARSE_FAILED",

        file:
          file?.name || "unknown",

        pages:
          extracted.pages,

        characters:
          extracted.text.length,

        questions:
          count,

        durationMs:
          Date.now() - started,

        timestamp:
          Date.now()
      };

      localStorage.setItem(
        "PCB_PDF_GENERIC_REPORT",
        JSON.stringify(report)
      );

      window.dispatchEvent(
        new CustomEvent(
          "PCB_PDF_GENERIC_COMPLETE",
          {
            detail: report
          }
        )
      );

      return report;

    } catch (error) {

      const report = {
        status: "ERROR",

        file:
          file?.name || "unknown",

        questions: 0,

        error:
          String(
            error?.message ||
            error
          ),

        timestamp:
          Date.now()
      };

      localStorage.setItem(
        "PCB_PDF_GENERIC_REPORT",
        JSON.stringify(report)
      );

      window.dispatchEvent(
        new CustomEvent(
          "PCB_PDF_GENERIC_COMPLETE",
          {
            detail: report
          }
        )
      );

      throw error;
    }
  }

  window.PCBPDFGenericFinal = {
    extract,
    parseText,
    process,
    save
  };

})();
