(function () {
  "use strict";

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getQuestions(value) {
    if (Array.isArray(value)) return value;

    if (
      value &&
      Array.isArray(value.questions)
    ) {
      return value.questions;
    }

    if (
      value &&
      Array.isArray(value.items)
    ) {
      return value.items;
    }

    return [];
  }

  function result(name, ok, detail) {
    return {
      check: name,
      status: ok ? "PASS" : "FAIL",
      detail: detail || ""
    };
  }

  function run() {
    const active = read("CBT_ACTIVE_TEST");
    const pdf = read("pdfCbtQuestions");
    const ranker = read("rbSelectedQuestions");

    const activeQs = getQuestions(active);
    const pdfQs = getQuestions(pdf);
    const rankerQs = getQuestions(ranker);

    const source =
      localStorage.getItem(
        "CBT_ACTIVE_SOURCE"
      ) || "";

    const testId =
      active &&
      (
        active.id ||
        active.testId ||
        ""
      );

    const checks = [];

    checks.push(
      result(
        "PDF QUESTIONS AVAILABLE",
        pdfQs.length > 0,
        pdfQs.length + " questions"
      )
    );

    checks.push(
      result(
        "RANKER QUESTIONS AVAILABLE",
        rankerQs.length > 0,
        rankerQs.length + " questions"
      )
    );

    checks.push(
      result(
        "ACTIVE CBT TEST AVAILABLE",
        activeQs.length > 0,
        activeQs.length + " questions"
      )
    );

    checks.push(
      result(
        "ACTIVE SOURCE SET",
        !!source,
        source || "missing"
      )
    );

    checks.push(
      result(
        "ACTIVE TEST ID SET",
        !!testId,
        testId || "missing"
      )
    );

    const activeTitle =
      active &&
      (
        active.title ||
        active.name ||
        ""
      );

    checks.push(
      result(
        "ACTIVE TEST TITLE SET",
        !!activeTitle,
        activeTitle || "missing"
      )
    );

    const validQuestionShape =
      activeQs.length === 0 ||
      activeQs.every(function (q) {
        return q &&
          String(
            q.question ||
            q.questionText ||
            q.text ||
            q.q ||
            ""
          ).trim();
      });

    checks.push(
      result(
        "ACTIVE QUESTIONS NORMALIZED",
        validQuestionShape,
        validQuestionShape
          ? "valid question text"
          : "invalid question detected"
      )
    );

    const report = {
      timestamp:
        new Date().toISOString(),

      source,

      testId,

      counts: {
        pdf: pdfQs.length,
        ranker: rankerQs.length,
        active: activeQs.length
      },

      checks,

      pass:
        checks.filter(
          x => x.status === "PASS"
        ).length,

      fail:
        checks.filter(
          x => x.status === "FAIL"
        ).length
    };

    localStorage.setItem(
      "PCB_REAL_FLOW_TEST_REPORT",
      JSON.stringify(report)
    );

    console.table(checks);

    console.log(
      "PCB REAL FLOW:",
      report.pass +
      "/" +
      checks.length +
      " PASS"
    );

    return report;
  }

  window.PCBRealFlowTestSuite = {
    run: run
  };

})();
