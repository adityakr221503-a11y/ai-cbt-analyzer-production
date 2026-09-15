(function () {
  "use strict";

  const TESTS_KEY = "PCB_CBT_TESTS";
  const ACTIVE_KEY = "CBT_ACTIVE_TEST";
  const SOURCE_KEY = "CBT_ACTIVE_SOURCE";
  const PDF_KEY = "pdfCbtQuestions";

  function read(key, fallback) {
    try {
      const x = JSON.parse(
        localStorage.getItem(key) || "null"
      );
      return x == null ? fallback : x;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }

  function clean(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalize(q, index, testId) {
    if (!q || typeof q !== "object")
      return null;

    const question = clean(
      q.question ??
      q.questionText ??
      q.text ??
      q.q
    );

    if (!question)
      return null;

    let options =
      Array.isArray(q.options)
        ? q.options
        : [
            q.option1,
            q.option2,
            q.option3,
            q.option4
          ].filter(Boolean);

    options = options
      .map(clean)
      .filter(Boolean);

    return {
      ...q,
      id:
        q.id ||
        `${testId}-q-${index + 1}`,
      question,
      options,
      testId,
      source:
        q.source ||
        "PDF Import",
      testSource:
        "PDF Import"
    };
  }

  function unique(questions) {
    const seen = new Set();

    return questions.filter(q => {
      const key =
        clean(q.question)
          .toLowerCase();

      if (!key || seen.has(key))
        return false;

      seen.add(key);
      return true;
    });
  }

  function slug(name) {
    return clean(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  function createFromPDF(
    questions,
    filename
  ) {
    if (!Array.isArray(questions))
      return {
        ok: false,
        error:
          "PDF questions are not an array"
      };

    const stamp = Date.now();

    const base =
      slug(filename) ||
      "pdf-test";

    const testId =
      `pdf-${base}-${stamp}`;

    let normalized =
      questions
        .map((q, i) =>
          normalize(
            q,
            i,
            testId
          )
        )
        .filter(Boolean);

    normalized =
      unique(normalized);

    if (!normalized.length) {
      return {
        ok: false,
        error:
          "No valid questions found in PDF"
      };
    }

    const tests =
      read(TESTS_KEY, {});

    const test = {
      testId,
      title:
        filename ||
        "PDF Test",
      source:
        "PDF Import",
      filename:
        filename || "",
      questionCount:
        normalized.length,
      questions:
        normalized,
      createdAt:
        stamp,
      updatedAt:
        stamp
    };

    tests[testId] = test;

    save(
      TESTS_KEY,
      tests
    );

    /*
     * Compatibility with existing
     * PDF and CBT modules.
     */
    save(
      PDF_KEY,
      normalized
    );

    save(
      ACTIVE_KEY,
      test
    );

    localStorage.setItem(
      SOURCE_KEY,
      "PDF Import"
    );

    return {
      ok: true,
      testId,
      title: test.title,
      count:
        normalized.length,
      test
    };
  }

  function activate(testId) {
    const tests =
      read(TESTS_KEY, {});

    const test =
      tests[testId];

    if (
      !test ||
      !Array.isArray(test.questions) ||
      !test.questions.length
    ) {
      return {
        ok: false,
        error:
          "Test not found or empty"
      };
    }

    save(
      ACTIVE_KEY,
      test
    );

    save(
      PDF_KEY,
      test.questions
    );

    localStorage.setItem(
      SOURCE_KEY,
      test.source
    );

    return {
      ok: true,
      test
    };
  }

  function list() {
    const tests =
      read(TESTS_KEY, {});

    return Object.values(tests)
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

  function getActive() {
    const x =
      read(ACTIVE_KEY, null);

    return (
      x &&
      Array.isArray(x.questions) &&
      x.questions.length
    )
      ? x
      : null;
  }

  function openCBT(testId) {
    const result =
      activate(testId);

    if (!result.ok)
      return result;

    window.location.href =
      "cbt.html";

    return result;
  }

  window.PCBPDFTestSession = {
    createFromPDF,
    activate,
    list,
    getActive,
    openCBT
  };

})();
