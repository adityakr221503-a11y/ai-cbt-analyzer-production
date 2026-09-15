(function () {
  "use strict";

  const TARGET = "pdfCbtQuestions";

  const SOURCES = [
    "pdfCbtQuestions",
    "pdfQuestions",
    "cbtQuestions",
    "importedQuestions",
    "pdfQuestionBank",
    "questionBank"
  ];

  function extract(value) {
    if (!value) return [];

    if (Array.isArray(value))
      return value;

    if (typeof value === "object") {
      for (const key of [
        "questions",
        "data",
        "items",
        "questionBank"
      ]) {
        if (Array.isArray(value[key]))
          return value[key];
      }
    }

    return [];
  }

  function normalize(q, index) {
    if (!q || typeof q !== "object")
      return null;

    const question =
      q.question ??
      q.text ??
      q.questionText ??
      q.q;

    if (!question || String(question).trim() === "")
      return null;

    const options =
      Array.isArray(q.options)
        ? q.options
        : [
            q.option1,
            q.option2,
            q.option3,
            q.option4
          ].filter(Boolean);

    return {
      ...q,
      id:
        q.id ??
        "pdf-recovered-" + index,

      question:
        String(question).trim(),

      options,

      correctAnswer:
        q.correctAnswer ??
        q.answer ??
        q.correct ??
        null,

      source:
        q.source ??
        "PDF Import",

      importedFromPDF: true
    };
  }

  function collect() {

    const all = [];
    const seen = new Set();

    for (const key of SOURCES) {

      let raw;

      try {
        raw =
          localStorage.getItem(key);
      } catch (_) {
        continue;
      }

      if (!raw) continue;

      let parsed;

      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        continue;
      }

      const questions =
        extract(parsed);

      questions.forEach(
        (q, index) => {

          const n =
            normalize(
              q,
              all.length + index
            );

          if (!n) return;

          const identity =
            String(
              n.question
            )
              .trim()
              .toLowerCase();

          if (seen.has(identity))
            return;

          seen.add(identity);
          all.push(n);
        }
      );
    }

    return all;
  }

  function recover() {

    const questions =
      collect();

    if (!questions.length) {

      localStorage.setItem(
        "PCB_PDF_RECOVERY_STATUS",
        JSON.stringify({
          status: "NO_QUESTIONS",
          count: 0,
          timestamp: Date.now()
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
      "PCB_PDF_RECOVERY_STATUS",
      JSON.stringify({
        status: "RECOVERED",
        count: questions.length,
        timestamp: Date.now()
      })
    );

    return questions.length;
  }

  function boot() {

    recover();

    setTimeout(
      recover,
      1500
    );

    setTimeout(
      recover,
      4000
    );

    setTimeout(
      recover,
      8000
    );
  }

  window.PCBPDFAutoRecovery = {
    recover,
    collect
  };

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
