(function () {
  "use strict";

  const REPORT_KEY = "pcbPdfCbtSessionVerification";

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function questionsFrom(value) {
    if (Array.isArray(value)) return value;

    if (value && Array.isArray(value.questions)) {
      return value.questions;
    }

    if (value && Array.isArray(value.items)) {
      return value.items;
    }

    return [];
  }

  function fingerprint(questions) {
    return questions
      .map(function (q) {
        return String(
          q &&
          (
            q.id ||
            q.question ||
            q.questionText ||
            q.text ||
            ""
          )
        )
          .trim()
          .toLowerCase();
      })
      .filter(Boolean)
      .join("|");
  }

  function verify() {
    const active = read("CBT_ACTIVE_TEST");
    const pdf = read("pdfCbtQuestions");
    const ranker = read("rbSelectedQuestions");

    const activeQuestions =
      questionsFrom(active);

    const pdfQuestions =
      questionsFrom(pdf);

    const rankerQuestions =
      questionsFrom(ranker);

    const source =
      localStorage.getItem(
        "CBT_ACTIVE_SOURCE"
      ) || "";

    const activeId =
      active &&
      (
        active.id ||
        active.testId
      );

    const activePdf =
      source.toLowerCase().includes("pdf") ||
      (
        active &&
        String(active.source || "")
          .toLowerCase()
          .includes("pdf")
      );

    const report = {
      timestamp:
        new Date().toISOString(),

      status: "PASS",

      activeSource: source,

      activeTestId:
        activeId || null,

      activeQuestionCount:
        activeQuestions.length,

      pdfQuestionCount:
        pdfQuestions.length,

      rankerQuestionCount:
        rankerQuestions.length,

      checks: {}
    };

    report.checks.activeTestExists =
      !!active;

    report.checks.activeHasQuestions =
      activeQuestions.length > 0;

    report.checks.pdfHasQuestions =
      pdfQuestions.length > 0;

    report.checks.pdfSourceDetected =
      activePdf;

    if (
      activePdf &&
      activeQuestions.length &&
      pdfQuestions.length
    ) {
      report.checks.activeMatchesPdf =
        fingerprint(activeQuestions) ===
        fingerprint(pdfQuestions);
    } else {
      report.checks.activeMatchesPdf =
        null;
    }

    if (
      activePdf &&
      report.checks.activeMatchesPdf === false
    ) {
      report.status = "FAIL";
    }

    report.summary =
      report.status === "PASS"
        ? "Active PDF CBT session is internally consistent."
        : "Active PDF CBT session does not match the imported PDF question set.";

    localStorage.setItem(
      REPORT_KEY,
      JSON.stringify(report)
    );

    window.dispatchEvent(
      new CustomEvent(
        "PCB_PDF_CBT_SESSION_VERIFIED",
        {
          detail: report
        }
      )
    );

    return report;
  }

  window.PCBPDFCBTSessionVerifier = {
    verify
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      verify
    );
  } else {
    verify();
  }
})();
