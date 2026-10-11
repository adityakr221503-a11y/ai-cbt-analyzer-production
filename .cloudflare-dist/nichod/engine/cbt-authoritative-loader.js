(function () {
  "use strict";

  const ACTIVE = "CBT_ACTIVE_TEST";
  const SOURCE = "CBT_ACTIVE_SOURCE";

  function parse(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function validQuestions(value) {
    return Array.isArray(value) &&
      value.length > 0 &&
      value.some(function (q) {
        return q &&
          String(
            q.question ||
            q.questionText ||
            q.text ||
            q.q ||
            ""
          ).trim();
      });
  }

  function normalize(list) {
    if (!Array.isArray(list)) return [];

    return list
      .filter(Boolean)
      .map(function (q, i) {
        const options =
          Array.isArray(q.options)
            ? q.options
            : [
                q.optionA,
                q.optionB,
                q.optionC,
                q.optionD
              ].filter(function (x) {
                return x != null &&
                  String(x).trim();
              });

        return Object.assign({}, q, {
          id:
            q.id ||
            q.questionId ||
            "cbt-" +
            Date.now() +
            "-" +
            i,

          question:
            q.question ||
            q.questionText ||
            q.text ||
            q.q ||
            "",

          options
        });
      })
      .filter(function (q) {
        return String(q.question).trim();
      });
  }

  function load() {
    const active = parse(ACTIVE);

    /*
     * ACTIVE TEST always has priority.
     */
    if (
      active &&
      validQuestions(active.questions)
    ) {
      return {
        source:
          active.source ||
          localStorage.getItem(SOURCE) ||
          "Active Test",

        testId:
          active.id ||
          active.testId ||
          null,

        title:
          active.title ||
          "Active CBT Test",

        questions:
          normalize(active.questions)
      };
    }

    /*
     * PDF compatibility fallback.
     */
    const pdf =
      normalize(
        parse("pdfCbtQuestions")
      );

    if (validQuestions(pdf)) {
      return {
        source: "PDF Import",
        testId: null,
        title: "PDF Imported Test",
        questions: pdf
      };
    }

    /*
     * Ranker compatibility fallback.
     */
    const ranker =
      normalize(
        parse("rbSelectedQuestions")
      );

    if (validQuestions(ranker)) {
      return {
        source:
          localStorage.getItem(SOURCE) ||
          "Rankers Test Series",

        testId: null,
        title: "Ranker Test",
        questions: ranker
      };
    }

    return {
      source: null,
      testId: null,
      title: null,
      questions: []
    };
  }

  function activate(test) {
    const qs =
      normalize(
        test &&
        test.questions
      );

    if (!qs.length) {
      return {
        ok: false,
        error: "No valid CBT questions"
      };
    }

    const payload =
      Object.assign({}, test, {
        questions: qs
      });

    localStorage.setItem(
      ACTIVE,
      JSON.stringify(payload)
    );

    localStorage.setItem(
      SOURCE,
      payload.source ||
      "CBT"
    );

    localStorage.setItem(
      "CBT_ACTIVE_TEST_ID",
      String(
        payload.id ||
        payload.testId ||
        ""
      )
    );

    return {
      ok: true,
      test: payload,
      count: qs.length
    };
  }

  window.PCBAuthoritativeCBTLoader = {
    load,
    activate,
    normalize
  };

  window.dispatchEvent(
    new CustomEvent(
      "PCB_AUTHORITATIVE_CBT_LOADER_READY"
    )
  );

})();
