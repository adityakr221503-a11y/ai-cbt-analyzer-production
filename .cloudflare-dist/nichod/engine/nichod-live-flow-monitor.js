"use strict";

(function () {

  const REPORT_KEY =
    "pcbNichodLiveFlowReport";

  const snapshots = [];

  function readJSON(key) {
    try {
      return JSON.parse(
        localStorage.getItem(key) || "null"
      );
    } catch (_) {
      return null;
    }
  }

  function count(value) {

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

    if (
      value &&
      Array.isArray(value.items)
    )
      return value.items.length;

    return 0;
  }

  function snapshot(stage) {

    const pdf =
      readJSON("pdfCbtQuestions");

    const selected =
      readJSON("rbSelectedQuestions");

    const history =
      readJSON("cbtHistory");

    const report =
      readJSON(
        "pcbNichodE2EReport"
      );

    const item = {

      stage,

      time:
        new Date().toISOString(),

      page:
        location.pathname,

      pdfQuestions:
        count(pdf),

      selectedQuestions:
        count(selected),

      historyEntries:
        Array.isArray(history)
          ? history.length
          : 0,

      activeSource:
        localStorage.getItem(
          "CBT_ACTIVE_SOURCE"
        ),

      e2eStatus:
        report?.status || null,

      nichodObjects: {

        unified:
          !!window.PCBNICHODUnified,

        pdf:
          !!window.PCBNICHODPDF,

        health:
          !!window.PCBNICHODHealth,

        ranker:
          !!window.PCBNICHODRankerFeed,

        verified:
          !!window.PCBNICHODVerifiedFeed

      }

    };

    snapshots.push(item);

    save();

    return item;
  }

  function save() {

    const report = {

      version: 1,

      updatedAt:
        new Date().toISOString(),

      page:
        location.pathname,

      snapshots

    };

    localStorage.setItem(
      REPORT_KEY,
      JSON.stringify(
        report,
        null,
        2
      )
    );

  }

  function save() {

    const report = {

      version: 1,

      updatedAt:
        new Date().toISOString(),

      page:
        location.pathname,

      snapshots

    };

    localStorage.setItem(
      REPORT_KEY,
      JSON.stringify(
        report,
        null,
        2
      )
    );

  }

  function monitor() {

    snapshot(
      "PAGE_BOOT"
    );

    setTimeout(
      () => snapshot("T+1s"),
      1000
    );

    setTimeout(
      () => snapshot("T+3s"),
      3000
    );

    setTimeout(
      () => snapshot("T+5s"),
      5000
    );

    setTimeout(
      () => snapshot("T+10s"),
      10000
    );

  }

  window.PCBNICHODLiveFlow = {

    snapshot,

    getReport() {

      return readJSON(
        REPORT_KEY
      );

    },

    clear() {

      snapshots.length = 0;

      localStorage.removeItem(
        REPORT_KEY
      );

    }

  };

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      monitor
    );

  } else {

    monitor();

  }

})();
