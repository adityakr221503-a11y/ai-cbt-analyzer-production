(function () {
  "use strict";

  const ACTIVE = "CBT_ACTIVE_TEST";
  const SOURCE = "CBT_ACTIVE_SOURCE";
  const PDF = "pdfCbtQuestions";
  const RANKER = "rbSelectedQuestions";

  function read(key) {
    try {
      return JSON.parse(
        localStorage.getItem(key) || "null"
      );
    } catch (_) {
      return null;
    }
  }

  function valid(x) {
    return (
      x &&
      Array.isArray(x.questions) &&
      x.questions.length > 0
    );
  }

  function normalize(q, i, testId, source) {
    if (!q || typeof q !== "object")
      return null;

    const question = String(
      q.question ??
      q.questionText ??
      q.text ??
      q.q ??
      ""
    ).trim();

    if (!question)
      return null;

    let options = Array.isArray(q.options)
      ? q.options
      : [
          q.option1,
          q.option2,
          q.option3,
          q.option4
        ].filter(Boolean);

    return {
      ...q,
      id: q.id || `${testId}-q-${i + 1}`,
      question,
      options,
      testId,
      source: q.source || source,
      testSource: source
    };
  }

  function makeTest(raw, source, fallbackId) {
    if (!raw) return null;

    const questions =
      Array.isArray(raw)
        ? raw
        : raw.questions;

    if (!Array.isArray(questions))
      return null;

    const testId =
      raw.testId ||
      fallbackId;

    const normalized =
      questions
        .map((q, i) =>
          normalize(
            q,
            i,
            testId,
            source
          )
        )
        .filter(Boolean);

    if (!normalized.length)
      return null;

    return {
      ...raw,
      testId,
      source:
        raw.source ||
        source,
      title:
        raw.title ||
        `${source} Test`,
      questions:
        normalized
    };
  }

  function getActive() {
    const active =
      makeTest(
        read(ACTIVE),
        localStorage.getItem(SOURCE) ||
          "Active CBT",
        "active-cbt"
      );

    if (valid(active))
      return active;

    /*
     * Ranker selection has priority when
     * Ranker explicitly started the CBT.
     */
    const source =
      localStorage.getItem(SOURCE);

    if (
      source ===
      "Rankers Test Series"
    ) {
      const ranker =
        makeTest(
          read(RANKER),
          "Rankers Test Series",
          "ranker-active"
        );

      if (valid(ranker))
        return ranker;
    }

    /*
     * PDF selection.
     */
    if (
      source === "PDF" ||
      source === "PDF Import"
    ) {
      const pdf =
        makeTest(
          read(PDF),
          "PDF Import",
          "pdf-active"
        );

      if (valid(pdf))
        return pdf;
    }

    /*
     * Compatibility fallback.
     */
    const ranker =
      makeTest(
        read(RANKER),
        "Rankers Test Series",
        "ranker-active"
      );

    if (valid(ranker))
      return ranker;

    const pdf =
      makeTest(
        read(PDF),
        "PDF Import",
        "pdf-active"
      );

    if (valid(pdf))
      return pdf;

    return null;
  }

  function activate(test) {
    if (!valid(test))
      return null;

    localStorage.setItem(
      ACTIVE,
      JSON.stringify(test)
    );

    localStorage.setItem(
      SOURCE,
      test.source
    );

    if (
      test.source ===
      "Rankers Test Series"
    ) {
      localStorage.setItem(
        RANKER,
        JSON.stringify(
          test.questions
        )
      );
    }

    if (
      test.source ===
      "PDF Import"
    ) {
      localStorage.setItem(
        PDF,
        JSON.stringify(
          test.questions
        )
      );
    }

    return test;
  }

  function openCBT(test) {
    const active =
      activate(test);

    if (!active)
      return false;

    window.location.href =
      "cbt.html";

    return true;
  }

  window.PCBNICHODActiveCBTRouter = {
    getActive,
    activate,
    openCBT
  };

  /*
   * Make the active test available to
   * existing CBT code without replacing it.
   */
  const active = getActive();

  if (active) {
    window.PCB_NICHOD_ACTIVE_TEST =
      active;

    window.PCB_NICHOD_ACTIVE_QUESTIONS =
      active.questions;
  }

})();
