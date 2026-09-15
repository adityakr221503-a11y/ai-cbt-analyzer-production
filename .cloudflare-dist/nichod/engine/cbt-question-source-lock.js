(function () {
  "use strict";

  const ACTIVE = "CBT_ACTIVE_TEST";
  const PDF = "pdfCbtQuestions";
  const RANKER = "rbSelectedQuestions";

  function json(key) {
    try {
      const x = localStorage.getItem(key);
      return x ? JSON.parse(x) : null;
    } catch (_) {
      return null;
    }
  }

  function questions(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.questions)) return value.questions;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }

  function source() {
    return (
      localStorage.getItem("CBT_ACTIVE_SOURCE") ||
      sessionStorage.getItem("CBT_ACTIVE_SOURCE") ||
      ""
    ).toLowerCase();
  }

  function activeQuestions() {
    const active = json(ACTIVE);
    return questions(active);
  }

  function resolve() {
    const active = json(ACTIVE);
    const src = source();

    let qs = questions(active);

    if (qs.length) {
      return {
        questions: qs,
        source: active.source || src || "ACTIVE_TEST",
        testId: active.id || active.testId || null,
        authoritative: true
      };
    }

    if (src.includes("ranker")) {
      qs = questions(json(RANKER));

      if (qs.length) {
        return {
          questions: qs,
          source: "Rankers Test Series",
          testId: null,
          authoritative: true
        };
      }
    }

    if (src.includes("pdf")) {
      qs = questions(json(PDF));

      if (qs.length) {
        return {
          questions: qs,
          source: "PDF Import",
          testId: null,
          authoritative: true
        };
      }
    }

    /*
     * Last-resort legacy sources are deliberately NOT used.
     * This prevents fallback/demo questions from silently appearing.
     */
    return {
      questions: [],
      source: src || "UNKNOWN",
      testId: null,
      authoritative: false
    };
  }

  function expose() {
    const result = resolve();

    window.PCBAuthoritativeQuestionSource = {
      resolve,
      getQuestions: function () {
        return resolve().questions;
      },
      getSource: function () {
        return resolve().source;
      },
      hasQuestions: function () {
        return resolve().questions.length > 0;
      }
    };

    window.dispatchEvent(
      new CustomEvent(
        "PCB_AUTHORITATIVE_QUESTION_SOURCE_READY",
        { detail: result }
      )
    );

    return result;
  }

  expose();
})();
