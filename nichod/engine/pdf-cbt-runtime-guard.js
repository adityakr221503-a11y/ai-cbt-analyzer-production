"use strict";

(function () {

  const REPORT_KEY =
    "pcbPdfCbtRuntimeGuard";

  const STORAGE_KEYS = [
    "pdfCbtQuestions",
    "pdfQuestions",
    "cbtQuestions",
    "importedQuestions",
    "pdfQuestionBank",
    "questionBank"
  ];

  function parse(key) {
    try {
      return JSON.parse(
        localStorage.getItem(key) || "null"
      );
    } catch (_) {
      return null;
    }
  }

  function extract(value) {

    if (Array.isArray(value))
      return value;

    if (!value || typeof value !== "object")
      return [];

    const candidates = [
      value.questions,
      value.data,
      value.items,
      value.questionBank,
      value.questionArray,
      value.results
    ];

    for (const candidate of candidates) {

      if (Array.isArray(candidate))
        return candidate;

    }

    return [];
  }

  function normalize(q, index) {

    if (!q || typeof q !== "object")
      return null;

    const question = String(
      q.question ??
      q.questionText ??
      q.text ??
      q.q ??
      ""
    ).trim();

    if (!question)
      return null;

    let options =
      q.options ??
      q.choices ??
      q.answers ??
      [];

    if (!Array.isArray(options)) {

      if (
        options &&
        typeof options === "object"
      ) {

        options =
          Object.values(options);

      } else {

        options = [];

      }

    }

    options = options
      .map(x => String(
        typeof x === "object"
          ? (
              x.text ??
              x.label ??
              x.value ??
              ""
            )
          : x
      ).trim())
      .filter(Boolean);

    return {

      ...q,

      id:
        q.id ??
        "PDF-GUARD-" + index,

      question,

      options,

      subject:
        q.subject ??
        q.section ??
        "Unknown",

      topic:
        q.topic ??
        q.chapter ??
        "Unknown",

      source:
        q.source ??
        "PDF Import"

    };

  }

  function scan() {

    const sources = [];

    for (const key of STORAGE_KEYS) {

      const raw = parse(key);

      const extracted =
        extract(raw);

      if (extracted.length) {

        sources.push({

          key,

          count:
            extracted.length,

          questions:
            extracted
              .map(normalize)
              .filter(Boolean)

        });

      }

    }

    sources.sort(
      (a, b) =>
        b.questions.length -
        a.questions.length
    );

    const best =
      sources[0] || null;

    const report = {

      version: 1,

      time:
        new Date().toISOString(),

      page:
        location.pathname,

      storageKeysChecked:
        STORAGE_KEYS,

      sourcesFound:
        sources.map(x => ({
          key: x.key,
          count: x.count,
          normalized:
            x.questions.length
        })),

      selectedSource:
        best
          ? best.key
          : null,

      questionCount:
        best
          ? best.questions.length
          : 0,

      status:
        best &&
        best.questions.length
          ? "READY"
          : "NO_QUESTIONS"

    };

    localStorage.setItem(
      REPORT_KEY,
      JSON.stringify(
        report,
        null,
        2
      )
    );

    return {
      report,
      questions:
        best
          ? best.questions
          : []
    };

  }

  function promote() {

    const result = scan();

    if (
      !result.questions.length
    ) {

      console.warn(
        "PCB PDF GUARD: No normalized questions found."
      );

      return result;

    }

    /*
     * Always expose the best normalized
     * pool through the canonical key.
     */

    localStorage.setItem(
      "pdfCbtQuestions",
      JSON.stringify(
        result.questions
      )
    );

    localStorage.setItem(
      "CBT_ACTIVE_SOURCE",
      "PDF Import"
    );

    return result;

  }

  window.PCBPDFCBTRuntimeGuard = {

    scan,

    promote,

    getReport() {

      return parse(
        REPORT_KEY
      );

    }

  };

  function boot() {

    scan();

    /*
     * PDF parser may finish asynchronously.
     */

    setTimeout(
      promote,
      1500
    );

    setTimeout(
      scan,
      3000
    );

    setTimeout(
      promote,
      5000
    );

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
