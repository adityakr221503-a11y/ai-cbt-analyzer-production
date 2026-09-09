(function () {
  "use strict";

  const LIB =
    () => window.PCBUnifiedTestLibrary;

  function pdf(questions, filename) {
    if (!LIB()) {
      return {
        ok: false,
        error: "Unified test library unavailable"
      };
    }

    return LIB().createTest({
      title:
        filename ||
        "PDF Imported Test",
      source:
        "PDF Import",
      filename:
        filename || "",
      questions
    });
  }

  function ranker(
    questions,
    title
  ) {
    if (!LIB()) {
      return {
        ok: false,
        error: "Unified test library unavailable"
      };
    }

    return LIB().createTest({
      title:
        title ||
        "Ranker Test",
      source:
        "Rankers Test Series",
      questions
    });
  }

  function activateAndOpen(result) {
    if (
      !result ||
      !result.ok ||
      !result.test
    ) {
      return result;
    }

    localStorage.setItem(
      "CBT_ACTIVE_TEST",
      JSON.stringify(result.test)
    );

    localStorage.setItem(
      "CBT_ACTIVE_SOURCE",
      result.test.source
    );

    window.location.href =
      "cbt.html";

    return result;
  }

  window.PCBTestCreationBridge = {
    createPDFTest:
      pdf,

    createRankerTest:
      ranker,

    openCreatedTest:
      activateAndOpen
  };

})();
