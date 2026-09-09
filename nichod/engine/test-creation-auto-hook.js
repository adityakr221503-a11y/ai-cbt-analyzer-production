(function () {
  "use strict";

  const PDF_KEY = "pdfCbtQuestions";
  const RANKER_KEY = "rbSelectedQuestions";
  const ACTIVE_KEY = "CBT_ACTIVE_TEST";
  const SOURCE_KEY = "CBT_ACTIVE_SOURCE";

  let lastPDF = "";
  let lastRanker = "";

  function hashQuestions(list) {
    try {
      return JSON.stringify(
        (Array.isArray(list) ? list : [])
          .map(q => ({
            id: q && q.id,
            question:
              q &&
              (
                q.question ||
                q.questionText ||
                q.text ||
                q.q ||
                ""
              ),
            options:
              q && q.options
          }))
      );
    } catch (_) {
      return "";
    }
  }

  function read(key) {
    try {
      return JSON.parse(
        localStorage.getItem(key) ||
        "null"
      );
    } catch (_) {
      return null;
    }
  }

  function createPDF(list) {
    if (
      !window.PCBUnifiedTestLibrary ||
      !Array.isArray(list) ||
      !list.length
    ) {
      return null;
    }

    const signature =
      hashQuestions(list);

    if (
      !signature ||
      signature === lastPDF
    ) {
      return null;
    }

    lastPDF = signature;

    return window
      .PCBUnifiedTestLibrary
      .createTest({
        title:
          "PDF Imported Test " +
          new Date()
            .toLocaleString(),
        source:
          "PDF Import",
        questions:
          list
      });
  }

  function createRanker(list) {
    if (
      !window.PCBUnifiedTestLibrary ||
      !Array.isArray(list) ||
      !list.length
    ) {
      return null;
    }

    const signature =
      hashQuestions(list);

    if (
      !signature ||
      signature === lastRanker
    ) {
      return null;
    }

    lastRanker = signature;

    return window
      .PCBUnifiedTestLibrary
      .createTest({
        title:
          "Ranker Test " +
          new Date()
            .toLocaleString(),
        source:
          "Rankers Test Series",
        questions:
          list
      });
  }

  function scan() {
    const source =
      localStorage.getItem(
        SOURCE_KEY
      );

    const pdf =
      read(PDF_KEY);

    const ranker =
      read(RANKER_KEY);

    /*
     * Never create a PDF test from a
     * Ranker-only session.
     */
    if (
      source === "PDF" ||
      source === "PDF Import"
    ) {
      createPDF(pdf);
      return;
    }

    /*
     * Ranker explicitly selected.
     */
    if (
      source ===
      "Rankers Test Series"
    ) {
      createRanker(ranker);
      return;
    }
  }

  /*
   * Watch storage changes between pages.
   */
  window.addEventListener(
    "storage",
    scan
  );

  /*
   * Initial scan.
   */
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      scan
    );
  } else {
    scan();
  }

  /*
   * Expose manual hooks for existing
   * PDF/Ranker code.
   */
  window.PCBTestCreationAutoHook = {
    scan,
    createPDF,
    createRanker
  };

})();
