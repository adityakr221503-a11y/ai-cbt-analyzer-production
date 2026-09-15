(function () {
  "use strict";

  function json(key) {
    try {
      const x = localStorage.getItem(key);
      return x ? JSON.parse(x) : null;
    } catch (_) {
      return null;
    }
  }

  function questions(x) {
    if (Array.isArray(x)) return x;
    if (x && Array.isArray(x.questions)) return x.questions;
    if (x && Array.isArray(x.items)) return x.items;
    return [];
  }

  function check(name, value) {
    const qs = questions(value);

    return {
      name: name,
      ok: qs.length > 0,
      count: qs.length
    };
  }

  function run() {
    const active = json("CBT_ACTIVE_TEST");
    const pdf = json("pdfCbtQuestions");
    const ranker = json("rbSelectedQuestions");

    const results = [
      check("ACTIVE_TEST", active),
      check("PDF_IMPORT", pdf),
      check("RANKER_SELECTION", ranker)
    ];

    const activeSource =
      localStorage.getItem(
        "CBT_ACTIVE_SOURCE"
      ) || "";

    const report = {
      timestamp: new Date().toISOString(),

      activeSource,

      activeTestId:
        active &&
        (
          active.id ||
          active.testId ||
          null
        ),

      results,

      activeQuestionCount:
        questions(active).length,

      pdfQuestionCount:
        questions(pdf).length,

      rankerQuestionCount:
        questions(ranker).length,

      activeReady:
        questions(active).length > 0,

      pdfReady:
        questions(pdf).length > 0,

      rankerReady:
        questions(ranker).length > 0
    };

    localStorage.setItem(
      "PCB_REAL_FLOW_VALIDATION",
      JSON.stringify(report)
    );

    window.dispatchEvent(
      new CustomEvent(
        "PCB_REAL_FLOW_VALIDATED",
        {
          detail: report
        }
      )
    );

    console.table(results);

    return report;
  }

  window.PCBRealFlowValidator = {
    run
  };

})();
