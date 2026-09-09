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

    check(
      "Ranker Lifecycle",
      !!window.RankerV11Lifecycle
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

    check(
      "Mentor evidence store",
      !!evidence
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

      check(
        "Health status",
        health.status === "PASS",
        health.status
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

    const old =
      document.getElementById(
        "nichodE2EPanel"
      );

    if (old)
      old.remove();

    const panel =
      document.createElement(
        "section"
      );

    panel.id =
      "nichodE2EPanel";

    panel.style.cssText =
      [
        "position:relative",
        "margin:16px",
        "padding:18px",
        "border:2px solid #888",
        "border-radius:16px",
        "background:#fff",
        "font-family:system-ui",
        "z-index:9999"
      ].join(";");

    let html =
      "<h2>🧪 PCB NICHOD E2E Test</h2>";

    html +=
      "<p><b>Status:</b> " +
      report.status +
      "</p>";

    html +=
      "<p>PASS: " +
      report.passed +
      " | FAIL: " +
      report.failed +
      "</p>";

    html += "<hr>";

    report.results.forEach(
      item => {

        html +=
          "<div style='margin:6px 0'>" +
          (
            item.status === "PASS"
              ? "✅ "
              : "❌ "
          ) +
          "<b>" +
          item.name +
          "</b>" +
          (
            item.detail
              ? " — " +
                item.detail
              : ""
          ) +
          "</div>";

      }
    );

    html +=
      "<hr><button id='nichodE2ERun' " +
      "style='padding:10px 16px'>" +
      "Run Again" +
      "</button>";

    panel.innerHTML =
      html;

    document.body.prepend(
      panel
    );

    document
      .getElementById(
        "nichodE2ERun"
      )
      ?.addEventListener(
        "click",
        run
      );

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
