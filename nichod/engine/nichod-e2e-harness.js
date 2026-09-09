"use strict";

(function () {

  const KEY = "pcbNichodE2EReport";

  const results = [];

  function pass(name, detail) {
    results.push({
      name,
      status: "PASS",
      detail: detail || ""
    });
  }

  function fail(name, detail) {
    results.push({
      name,
      status: "FAIL",
      detail: detail || ""
    });
  }

  function check(name, condition, detail) {
    condition
      ? pass(name, detail)
      : fail(name, detail);
  }

  function getJSON(key) {
    try {
      return JSON.parse(
        localStorage.getItem(key) || "null"
      );
    } catch (_) {
      return null;
    }
  }

  function countQuestions(value) {

    if (Array.isArray(value))
      return value.length;

    if (
      value &&
      Array.isArray(value.questions)
    )
      return value.questions.length;

    if (
      value &&
      Array.isArray(value.data)
    )
      return value.data.length;

    return 0;
  }

  function run() {

    results.length = 0;

    /*
    =========================================
    1. CORE OBJECTS
    =========================================
    */

    check(
      "NICHOD Unified",
      !!window.PCBNICHODUnified
    );

    check(
      "NICHOD Health",
      !!window.PCBNICHODHealth
    );

    check(
      "PDF Bridge",
      !!window.PCBNICHODPDF
    );

    const pagePath =
      String(
        location.pathname || ""
      ).toLowerCase();

    const activeSource =
      String(
        localStorage.getItem(
          "CBT_ACTIVE_SOURCE"
        ) || ""
      ).toLowerCase();

    const rankerContext =
      pagePath.includes(
        "rankers-test-series"
      ) ||
      (
        pagePath.endsWith("cbt.html") &&
        activeSource.includes("ranker")
      );

    check(
      "Ranker Lifecycle",
      !rankerContext ||
      !!window.RankerV11Lifecycle,
      rankerContext
        ? (
            window.RankerV11Lifecycle
              ? "loaded"
              : "required but missing"
          )
        : "not required on this page"
    );

    /*
    =========================================
    2. SUBJECT SUPPORT
    =========================================
    */

    const subjects =
      window.PCBNICHODUnified?.SUBJECTS;

    check(
      "Physics support",
      !!subjects?.Physics
    );

    check(
      "Chemistry support",
      !!subjects?.Chemistry
    );

    check(
      "Biology support",
      !!subjects?.Biology
    );

    /*
    =========================================
    3. PDF QUESTION POOL
    =========================================
    */

    const pdf =
      getJSON(
        "pdfCbtQuestions"
      );

    const pdfCount =
      countQuestions(pdf);

    check(
      "PDF question pool",
      pdfCount > 0,
      pdfCount +
      " question(s)"
    );

    /*
    =========================================
    4. RANKER SELECTION
    =========================================
    */

    const selected =
      getJSON(
        "rbSelectedQuestions"
      );

    const selectedCount =
      countQuestions(selected);

    check(
      "Ranker selection pool",
      selectedCount > 0,
      selectedCount +
      " question(s)"
    );

    /*
    =========================================
    5. CBT SOURCE
    =========================================
    */

    const source =
      localStorage.getItem(
        "CBT_ACTIVE_SOURCE"
      );

    check(
      "CBT source recorded",
      !!source,
      source || "not recorded"
    );

    /*
    =========================================
    6. NICHOD PLAN
    =========================================
    */

    const plan =
      getJSON(
        "pcbNichodAdaptivePlan"
      );

    check(
      "Adaptive plan",
      !!plan
    );

    check(
      "Adaptive next action",
      !!plan?.nextAction
    );

    /*
    =========================================
    7. MENTOR EVIDENCE
    =========================================
    */

    const evidence =
      getJSON(
        "pcbNichodMentorEvidence"
      );

    const historyForMentor =
      getJSON(
        "cbtHistory"
      );

    /*
     * Mentor evidence is produced by the post-test flow.
     * Before the first completed attempt, absence is expected.
     */
    const mentorEvidenceReady =
      !!evidence ||
      !Array.isArray(historyForMentor) ||
      historyForMentor.length === 0;

    check(
      "Mentor evidence store",
      mentorEvidenceReady,
      mentorEvidenceReady
        ? (
            evidence
              ? "available"
              : "awaiting first completed test"
          )
        : "missing after completed test"
    );

    /*
    =========================================
    8. HISTORY
    =========================================
    */

    const history =
      getJSON(
        "cbtHistory"
      );

    check(
      "CBT history store",
      history !== null
    );

    /*
    =========================================
    9. HEALTH REPORT
    =========================================
    */

    const health =
      window.PCBNICHODHealth?.getReport?.();

    check(
      "NICHOD health report",
      !!health
    );

    if (health) {

      const healthStatus =
        health.status ||
        (
          health.health &&
          health.health.percentage === 100
            ? "PASS"
            : "ATTENTION"
        );

      check(
        "Health status",
        healthStatus === "PASS",
        healthStatus
      );

    }

    /*
    =========================================
    10. ADAPTIVE FUNCTION
    =========================================
    */

    const unified =
      window.PCBNICHODUnified;

    let adaptiveOK = false;

    try {

      const action =
        unified?.buildNextAction?.();

      adaptiveOK =
        !!action &&
        typeof action === "object";

    } catch (_) {}

    check(
      "Adaptive next-action engine",
      adaptiveOK
    );

    /*
    =========================================
    FINAL
    =========================================
    */

    const passed =
      results.filter(
        x => x.status === "PASS"
      ).length;

    const failed =
      results.filter(
        x => x.status === "FAIL"
      ).length;

    const report = {

      version: 1,

      timestamp:
        new Date().toISOString(),

      page:
        location.pathname,

      passed,

      failed,

      total:
        results.length,

      status:
        failed === 0
          ? "PASS"
          : "ATTENTION",

      results

    };

    localStorage.setItem(
      KEY,
      JSON.stringify(
        report,
        null,
        2
      )
    );

    render(report);

    return report;

  }

  function render(report) {
    /*
     * NICHOD E2E is a diagnostic harness.
     * Keep report generation/storage/API active,
     * but never inject the internal test panel into
     * the student-facing CBT/Test Series UI.
     */
    return report;
  }

  window.PCBNICHODE2E = {
    run,
    getReport:
      () =>
        getJSON(KEY)
  };

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      function () {

        setTimeout(
          run,
          1000
        );

      }
    );

  } else {

    setTimeout(
      run,
      1000
    );

  }

})();
