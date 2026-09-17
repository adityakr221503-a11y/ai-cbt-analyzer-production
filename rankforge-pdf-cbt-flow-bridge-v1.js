/*
 * RankForge PDF -> CBT Flow Bridge V1
 * -----------------------------------
 * Purpose:
 *   PDF Import -> Active CBT -> Result -> Mistake -> Retry/Mastery
 *
 * Rules:
 *   - Never changes question content.
 *   - Never changes TOPPER_TEST_180.
 *   - Never imports DPP.
 *   - Preserves the active PDF test identity.
 *   - Recovers CBT_ACTIVE_TEST from CBT_ACTIVE_QUESTIONS when necessary.
 *   - Mirrors the active test into localStorage for page-navigation safety.
 */
(function () {
  "use strict";

  const K = {
    questions: "CBT_ACTIVE_QUESTIONS",
    test: "CBT_ACTIVE_TEST",
    testId: "CBT_ACTIVE_TEST_ID",
    source: "CBT_ACTIVE_SOURCE",
    pdfPool: "pdfCbtQuestions"
  };

  function parse(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function sessionParse(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function sessionSave(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function getQuestions() {
    const candidates = [
      sessionParse(K.questions),
      parse(K.questions)
    ];

    for (const q of candidates) {
      if (Array.isArray(q) && q.length) return q;
    }

    return [];
  }

  function getActiveTest() {
    const candidates = [
      sessionParse(K.test),
      parse(K.test)
    ];

    for (const t of candidates) {
      if (t && typeof t === "object" && Array.isArray(t.questions) && t.questions.length) {
        return t;
      }
    }

    return null;
  }

  function makeId() {
    return "PDF-CBT-" +
      Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 8);
  }

  function isPdfTest(test) {
    if (!test) return false;

    const source = String(
      test.source ||
      test.testSource ||
      test.origin ||
      ""
    ).toLowerCase();

    const title = String(test.title || "").toLowerCase();

    return (
      source.includes("pdf") ||
      title.includes("pdf") ||
      title.includes("pdf module")
    );
  }

  function normalizeQuestion(q, index) {
    if (!q || typeof q !== "object") return null;

    const text =
      q.text ||
      q.question ||
      q.questionText ||
      q.question_text ||
      "";

    const options =
      Array.isArray(q.options) ? q.options :
      Array.isArray(q.choices) ? q.choices :
      [];

    if (!String(text).trim() || options.length < 2) return null;

    return {
      ...q,
      id: q.id || `PDF-FLOW-Q-${index + 1}`,
      text: String(text),
      question: String(q.question || text),
      options: options.map(x => String(x)),
      correctAnswer: q.correctAnswer ?? q.answer ?? "",
      correctIndex:
        Number.isInteger(q.correctIndex)
          ? q.correctIndex
          : -1
    };
  }

  function buildFromQuestions(questions) {
    const normalized = questions
      .map(normalizeQuestion)
      .filter(Boolean);

    if (!normalized.length) return null;

    const id = makeId();

    return {
      id,
      title: "PDF Module CBT",
      source: "PDF Import",
      sourceType: "pdf",
      filename: "",
      questionCount: normalized.length,
      questions: normalized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function persist(test) {
    if (!test) return;

    const payload = {
      ...test,
      questionCount:
        Array.isArray(test.questions)
          ? test.questions.length
          : Number(test.questionCount || 0),
      updatedAt: new Date().toISOString()
    };

    sessionSave(K.test, payload);
    sessionSave(K.testId, payload.id);
    sessionSave(K.source, payload.source || "PDF Import");
    sessionSave(K.questions, payload.questions);

    save(K.test, payload);
    save(K.testId, payload.id);
    save(K.source, payload.source || "PDF Import");
    save(K.questions, payload.questions);
  }

  function bootstrap() {
    let test = getActiveTest();

    /*
     * If PDF engine supplied only active questions,
     * construct the canonical active test.
     */
    if (!test) {
      const questions = getQuestions();

      if (questions.length) {
        test = buildFromQuestions(questions);

        if (test) {
          persist(test);
        }
      }
    }

    /*
     * If a PDF test already exists, repair missing metadata
     * without replacing its questions.
     */
    if (test && isPdfTest(test)) {
      const questions = Array.isArray(test.questions)
        ? test.questions.map(normalizeQuestion).filter(Boolean)
        : [];

      if (questions.length) {
        test.questions = questions;
        test.questionCount = questions.length;
        test.source = test.source || "PDF Import";
        test.sourceType = "pdf";
        test.title = test.title || "PDF Module CBT";
        test.id = test.id || makeId();

        persist(test);
      }
    }

    window.RankForgePDFCBTFlowV1 = {
      getActiveTest,
      getQuestions,
      persist,
      bootstrap
    };

    return test;
  }

  /*
   * Run after the existing PDF/CBT scripts have had time
   * to establish their storage.
   */
  function delayedBootstrap() {
    bootstrap();

    setTimeout(bootstrap, 250);
    setTimeout(bootstrap, 1000);
    setTimeout(bootstrap, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", delayedBootstrap, { once: true });
  } else {
    delayedBootstrap();
  }

  window.addEventListener("pagehide", function () {
    try {
      const test = getActiveTest();
      if (test) persist(test);
    } catch (_) {}
  });

  window.addEventListener("beforeunload", function () {
    try {
      const test = getActiveTest();
      if (test) persist(test);
    } catch (_) {}
  });

})();
