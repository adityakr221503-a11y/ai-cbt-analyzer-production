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
    if (!raw) {
      console.warn("[RankForge V318] PDF mode requested but PDF pool is empty.");
      return;
    }

    let questions;

    try {
      questions = JSON.parse(raw);
    } catch (e) {
      console.error("[RankForge V318] Invalid PDF pool JSON:", e);
      return;
    }

    if (!Array.isArray(questions) || !questions.length) {
      console.warn("[RankForge V318] PDF pool contains no questions.");
      return;
    }

    questions = questions.map(function(q, i) {
      q = q && typeof q === "object" ? q : {};

      let options = q.options ?? q.choices ?? q.answers ?? [];

      if (!Array.isArray(options) && options && typeof options === "object") {
        options = Object.values(options);
      }

      options = Array.isArray(options)
        ? options.map(function(x) {
            if (x && typeof x === "object") {
              return String(
                x.text ??
                x.value ??
                x.label ??
                x.option ??
                ""
              );
            }
            return String(x ?? "");
          }).filter(Boolean)
        : [];

      return {
        ...q,
        id: q.id || "PDF-" + (i + 1),
        question:
          q.question ??
          q.text ??
          q.questionText ??
          q.prompt ??
          q.stem ??
          "",
        text:
          q.text ??
          q.question ??
          q.questionText ??
          q.prompt ??
          q.stem ??
          "",
        options,
        source: "PDF Import",
        sourceType: "PDF",
        testNumber: 1,
        questionNumber: i + 1
      };
    }).filter(function(q) {
      return String(q.question || "").trim() &&
             Array.isArray(q.options) &&
             q.options.length >= 2;
    });

    if (!questions.length) {
      console.warn("[RankForge V318] PDF pool had no usable questions.");
      return;
    }

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
