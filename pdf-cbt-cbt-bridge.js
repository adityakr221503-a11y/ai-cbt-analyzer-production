/* =========================================================
   PDF CBT BRIDGE
   Makes PDF pool available to CBT without replacing
   the existing Ranker/CBT engines.
========================================================= */
(function () {
  "use strict";

  try {
    const params = new URLSearchParams(location.search);

    if (params.get("source") !== "pdf") return;

    const raw = localStorage.getItem("pdfCbtQuestions");
    if (!raw) return;

    const questions = JSON.parse(raw);

    if (!Array.isArray(questions) || !questions.length) return;

    window.PDF_CBT_QUESTIONS = questions;

    window.PDF_CBT_ACTIVE_TEST = {
      id: "pdf-cbt-" + Date.now(),
      title: "PDF Module CBT",
      source: "PDF Import",
      duration: 180,
      questions
    };

    sessionStorage.setItem(
      "PDF_CBT_ACTIVE",
      JSON.stringify(window.PDF_CBT_ACTIVE_TEST)
    );

    /*
      Expose common names used by existing CBT code.
      Existing variables/functions are not overwritten.
    */
    window.pdfCbtQuestions = questions;

    console.log(
      "PDF CBT bridge loaded:",
      questions.length,
      "questions"
    );
  } catch (e) {
    console.error("PDF CBT bridge error:", e);
  }
})();
