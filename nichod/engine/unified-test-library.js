(function () {
  "use strict";

  const KEY = "PCB_CBT_TESTS";
  const ACTIVE = "CBT_ACTIVE_TEST";
  const SOURCE = "CBT_ACTIVE_SOURCE";

  function read() {
    try {
      return JSON.parse(
        localStorage.getItem(KEY) || "{}"
      );
    } catch (_) {
      return {};
    }
  }

  function write(x) {
    localStorage.setItem(
      KEY,
      JSON.stringify(x)
    );
  }

  function normalizeQuestions(
    questions,
    testId,
    source
  ) {
    if (!Array.isArray(questions))
      return [];

    return questions
      .map((q, i) => {
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

        const options =
          Array.isArray(q.options)
            ? q.options
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
            `${testId}-q-${i + 1}`,
          question: text,
          options,
          testId,
          source
        };
      })
      .filter(Boolean);
  }

  function createTest({
    title,
    source,
    questions,
    filename
  }) {
    const stamp = Date.now();

    const prefix =
      source === "PDF Import"
        ? "pdf"
        : source === "Rankers Test Series"
          ? "ranker"
          : "cbt";

    const testId =
      `${prefix}-${stamp}`;

    const qs =
      normalizeQuestions(
        questions,
        testId,
        source
      );

    if (!qs.length) {
      return {
        ok: false,
        error:
          "No valid questions"
      };
    }

    const tests = read();

    const test = {
      testId,
      title:
        title ||
        `${source} Test`,
      source,
      filename:
        filename || "",
      questionCount:
        qs.length,
      questions: qs,
      createdAt:
        stamp,
      updatedAt:
        stamp
    };

    tests[testId] = test;

    write(tests);

    localStorage.setItem(
      ACTIVE,
      JSON.stringify(test)
    );

    localStorage.setItem(
      SOURCE,
      source
    );

    return {
      ok: true,
      test
    };
  }

  function activate(testId) {
    const tests = read();
    const test = tests[testId];

    if (
      !test ||
      !Array.isArray(test.questions) ||
      !test.questions.length
    ) {
      return {
        ok: false,
        error:
          "Test not found"
      };
    }

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
      "PDF Import"
    ) {
      localStorage.setItem(
        "pdfCbtQuestions",
        JSON.stringify(
          test.questions
        )
      );
    }

    if (
      test.source ===
      "Rankers Test Series"
    ) {
      localStorage.setItem(
        "rbSelectedQuestions",
        JSON.stringify(
          test.questions
        )
      );
    }

    return {
      ok: true,
      test
    };
  }

  function open(testId) {
    const result =
      activate(testId);

    if (!result.ok)
      return result;

    location.href =
      "cbt.html";

    return result;
  }

  function all() {
    return Object.values(read())
      .filter(
        t =>
          t &&
          Array.isArray(t.questions) &&
          t.questions.length
      )
      .sort(
        (a, b) =>
          Number(b.createdAt || 0) -
          Number(a.createdAt || 0)
      );
  }

  function remove(testId) {
    const tests = read();

    if (!tests[testId])
      return false;

    delete tests[testId];

    write(tests);

    return true;
  }

  window.PCBUnifiedTestLibrary = {
    createTest,
    activate,
    open,
    all,
    remove
  };

})();
