(function () {
  "use strict";

  const LIB = () =>
    window.PCBUnifiedTestLibrary;

  function normalize(list) {
    if (!Array.isArray(list)) return [];

    return list.filter(Boolean).map(function (q, i) {
      return Object.assign({}, q, {
        id:
          q.id ||
          q.questionId ||
          "q-" + Date.now() + "-" + i,

        question:
          q.question ||
          q.questionText ||
          q.text ||
          q.q ||
          "",

        options:
          Array.isArray(q.options)
            ? q.options
            : [
                q.optionA,
                q.optionB,
                q.optionC,
                q.optionD
              ].filter(Boolean)
      });
    }).filter(function (q) {
      return String(q.question || "").trim();
    });
  }

  function create(source, questions, title) {
    const qs = normalize(questions);

    if (!qs.length) {
      return {
        ok: false,
        error: "No valid questions"
      };
    }

    if (!LIB()) {
      return {
        ok: false,
        error: "Unified test library unavailable"
      };
    }

    const result =
      LIB().createTest({
        title:
          title ||
          (
            source === "PDF Import"
              ? "PDF Imported Test"
              : "Ranker Test"
          ),

        source,

        questions: qs
      });

    if (
      result &&
      result.ok &&
      result.test
    ) {
      localStorage.setItem(
        "CBT_ACTIVE_TEST",
        JSON.stringify(result.test)
      );

      localStorage.setItem(
        "CBT_ACTIVE_SOURCE",
        source
      );

      localStorage.setItem(
        "CBT_ACTIVE_TEST_ID",
        String(
          result.test.id ||
          result.test.testId ||
          ""
        )
      );
    }

    return result;
  }

  window.PCBLiveTestFlow = {
    normalize,
    createPDF: function (questions, title) {
      return create(
        "PDF Import",
        questions,
        title
      );
    },
    createRanker: function (questions, title) {
      return create(
        "Rankers Test Series",
        questions,
        title
      );
    }
  };

  window.dispatchEvent(
    new CustomEvent(
      "PCB_LIVE_TEST_FLOW_READY"
    )
  );

})();
