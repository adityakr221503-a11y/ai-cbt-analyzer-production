(function () {
  "use strict";

  const KEYS = {
    PDF: "pdfCbtQuestions",
    RANKER: "rbSelectedQuestions",
    ACTIVE_SOURCE: "CBT_ACTIVE_SOURCE",
    ACTIVE_TEST: "CBT_ACTIVE_TEST",
    TESTS: "PCB_CBT_TESTS"
  };

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (_) {}
  }

  function array(value) {
    return Array.isArray(value)
      ? value
      : value &&
        Array.isArray(value.questions)
        ? value.questions
        : [];
  }

  function normalize(q, index, testId, source) {
    if (!q || typeof q !== "object")
      return null;

    const text = String(
      q.question ??
      q.questionText ??
      q.text ??
      q.q ??
      ""
    ).trim();

    if (!text)
      return null;

    const options = Array.isArray(q.options)
      ? q.options.filter(Boolean)
      : [
          q.option1,
          q.option2,
          q.option3,
          q.option4
        ].filter(Boolean);

    return {
      ...q,

      id:
        q.id ||
        `${testId}-q-${index + 1}`,

      question: text,

      options,

      source:
        q.source ||
        source,

      testId,

      testSource: source
    };
  }

  function unique(list) {
    const seen = new Set();

    return list.filter(q => {
      const key =
        String(q.question || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      if (!key || seen.has(key))
        return false;

      seen.add(key);
      return true;
    });
  }

  function makeTestId(source, name) {
    const base =
      `${source}-${name || "test"}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return (
      base +
      "-" +
      Date.now().toString(36)
    );
  }

  function registerTest({
    source,
    title,
    questions,
    testId
  }) {
    const tests =
      read(KEYS.TESTS) || {};

    tests[testId] = {
      testId,
      title:
        title ||
        `${source} Test`,
      source,
      questionCount:
        questions.length,
      questions,
      createdAt:
        Date.now(),
      updatedAt:
        Date.now()
    };

    write(KEYS.TESTS, tests);

    write(
      KEYS.ACTIVE_TEST,
      tests[testId]
    );

    return tests[testId];
  }

  function createPDFTest(
    questions,
    filename
  ) {
    const normalized =
      unique(
        array(questions)
          .map((q, i) =>
            normalize(
              q,
              i,
              "pdf",
              "PDF Import"
            )
          )
          .filter(Boolean)
      );

    if (!normalized.length)
      return null;

    const testId =
      makeTestId(
        "pdf",
        filename
      );

    const test =
      registerTest({
        source:
          "PDF Import",
        title:
          filename ||
          "PDF Test",
        questions:
          normalized,
        testId
      });

    /*
     * Keep compatibility with
     * existing PDF CBT code.
     */
    write(
      KEYS.PDF,
      normalized
    );

    localStorage.setItem(
      KEYS.ACTIVE_SOURCE,
      "PDF Import"
    );

    return test;
  }

  function createRankerTest(
    questions,
    title
  ) {
    const normalized =
      unique(
        array(questions)
          .map((q, i) =>
            normalize(
              q,
              i,
              "ranker",
              "Rankers Test Series"
            )
          )
          .filter(Boolean)
      );

    if (!normalized.length)
      return null;

    const testId =
      makeTestId(
        "ranker",
        title
      );

    const test =
      registerTest({
        source:
          "Rankers Test Series",
        title:
          title ||
          "Rankers Test",
        questions:
          normalized,
        testId
      });

    write(
      KEYS.RANKER,
      normalized
    );

    localStorage.setItem(
      KEYS.ACTIVE_SOURCE,
      "Rankers Test Series"
    );

    return test;
  }

  function getActiveTest() {
    const active =
      read(KEYS.ACTIVE_TEST);

    if (
      active &&
      Array.isArray(active.questions) &&
      active.questions.length
    ) {
      return active;
    }

    return null;
  }

  function load() {

    /*
     * SOURCE-AWARE LOADING
     *
     * Never let an old ACTIVE_TEST override the source that
     * explicitly launched the CBT.
     */
    const activeSourceRaw =
      localStorage.getItem(
        KEYS.ACTIVE_SOURCE
      ) || "";

    const activeSource =
      String(activeSourceRaw)
        .trim()
        .toLowerCase();

    /*
     * 1. Ranker is authoritative when the current source
     * explicitly says Rankers Test Series.
     */
    if (
      activeSource ===
        "rankers test series" ||
      activeSource ===
        "ranker" ||
      activeSource ===
        "ranker pro"
    ) {

      const ranker =
        array(
          read(KEYS.RANKER)
        );

      if (ranker.length) {

        const questions =
          unique(
            ranker
              .map((q, i) =>
                normalize(
                  q,
                  i,
                  "ranker-active",
                  "Rankers Test Series"
                )
              )
              .filter(Boolean)
          );

        if (questions.length) {

          return {
            source:
              "Rankers Test Series",
            testId:
              "ranker-active",
            title:
              "Rankers Test",
            questions
          };
        }
      }

      /*
       * Ranker was explicitly requested but its own pool
       * is unavailable. Do NOT fall through to PDF.
       */
      return {
        source:
          "Rankers Test Series",
        testId:
          null,
        title:
          "Rankers Test",
        questions:
          []
      };
    }

    /*
     * 2. PDF is authoritative when PDF was explicitly launched.
     */
    if (
      activeSource ===
        "pdf import" ||
      activeSource ===
        "pdf"
    ) {

      const active =
        getActiveTest();

      if (
        active &&
        active.source &&
        String(active.source)
          .trim()
          .toLowerCase()
          .includes("pdf") &&
        Array.isArray(active.questions) &&
        active.questions.length
      ) {
        return {
          source:
            active.source,
          testId:
            active.testId,
          title:
            active.title,
          questions:
            active.questions
        };
      }

      const pdf =
        array(
          read(KEYS.PDF)
        );

      if (pdf.length) {

        const questions =
          unique(
            pdf
              .map((q, i) =>
                normalize(
                  q,
                  i,
                  "pdf-active",
                  "PDF Import"
                )
              )
              .filter(Boolean)
          );

        if (questions.length) {
          return {
            source:
              "PDF Import",
            testId:
              "pdf-active",
            title:
              "PDF Test",
            questions
          };
        }
      }

      return {
        source:
          "PDF Import",
        testId:
          null,
        title:
          "PDF Test",
        questions:
          []
      };
    }

    /*
     * 3. No explicit source:
     * only accept an active test whose source is valid.
     */
    const active =
      getActiveTest();

    if (
      active &&
      active.source &&
      Array.isArray(active.questions) &&
      active.questions.length
    ) {
      return {
        source:
          active.source,
        testId:
          active.testId,
        title:
          active.title,
        questions:
          active.questions
      };
    }

    /*
     * 4. Ranker fallback only when explicitly available.
     */
    const ranker =
      array(
        read(KEYS.RANKER)
      );

    if (ranker.length) {

      const questions =
        unique(
          ranker
            .map((q, i) =>
              normalize(
                q,
                i,
                "ranker-active",
                "Rankers Test Series"
              )
            )
            .filter(Boolean)
        );

      if (questions.length) {

        return {
          source:
            "Rankers Test Series",
          testId:
            "ranker-active",
          title:
            "Rankers Test",
          questions
        };
      }
    }

    /*
     * 3. PDF questions.
     */
    const pdf =
      array(
        read(KEYS.PDF)
      );

    if (pdf.length) {

      const questions =
        unique(
          pdf
            .map((q, i) =>
              normalize(
                q,
                i,
                "pdf-active",
                "PDF Import"
              )
            )
            .filter(Boolean)
        );

      if (questions.length) {

        return {
          source:
            "PDF Import",
          testId:
            "pdf-active",
          title:
            "PDF Test",
          questions
        };
      }
    }

    return {
      source: null,
      testId: null,
      title: null,
      questions: []
    };
  }

  function activate(testId) {

    const tests =
      read(KEYS.TESTS) || {};

    const test =
      tests[testId];

    if (
      !test ||
      !Array.isArray(test.questions)
    ) {
      return null;
    }

    write(
      KEYS.ACTIVE_TEST,
      test
    );

    localStorage.setItem(
      KEYS.ACTIVE_SOURCE,
      test.source
    );

    if (
      test.source ===
      "PDF Import"
    ) {
      write(
        KEYS.PDF,
        test.questions
      );
    }

    if (
      test.source ===
      "Rankers Test Series"
    ) {
      write(
        KEYS.RANKER,
        test.questions
      );
    }

    return test;
  }

  function clearActive() {
    localStorage.removeItem(
      KEYS.ACTIVE_TEST
    );
  }

  window.PCBUnifiedCBTLoader = {
    load,
    activate,
    clearActive,
    createPDFTest,
    createRankerTest,
    getActiveTest
  };

})();
