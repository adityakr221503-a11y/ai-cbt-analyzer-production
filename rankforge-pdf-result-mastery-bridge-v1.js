(function () {
  "use strict";

  const ACTIVE = "CBT_ACTIVE_TEST";
  const HISTORY = "cbtHistory";
  const MISTAKES = "rankforgeMistakesV1";
  const RETRIES = "retryHistory";
  const MASTERY = "cbtMasteryV2";

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function activeTest() {
    try {
      const a = JSON.parse(sessionStorage.getItem(ACTIVE) || "null");
      if (a && Array.isArray(a.questions) && a.questions.length) return a;
    } catch (_) {}

    const a = read(ACTIVE, null);
    return a && Array.isArray(a.questions) && a.questions.length
      ? a
      : null;
  }

  function text(q) {
    return String(
      q && (
        q.question ||
        q.questionText ||
        q.question_text ||
        q.text ||
        ""
      )
    ).trim();
  }

  function id(q, i) {
    return String(
      q && (
        q.id ||
        q.questionId ||
        q.question_id ||
        q.uid
      ) || ("pdf-q-" + i)
    ).trim();
  }

  function answer(q) {
    return q && (
      q.userAnswer ??
      q.selectedAnswer ??
      q.selectedOption ??
      q.answerGiven ??
      q.response ??
      ""
    );
  }

  function correct(q) {
    return q && (
      q.correctAnswer ??
      q.correct ??
      q.answer ??
      q.correctOption ??
      q.correctIndex ??
      ""
    );
  }

  function normal(v) {
    return String(v == null ? "" : v)
      .trim()
      .toLowerCase()
      .replace(/^option\s*/i, "")
      .replace(/[.)]$/, "");
  }

  function isWrong(q) {
    const a = normal(answer(q));
    const c = normal(correct(q));

    if (!a) return true;
    if (!c) return true;

    return a !== c;
  }

  function classify(q) {
    const explicit = String(
      q && (
        q.mistakeReason ||
        q.errorType ||
        q.mistakeType ||
        q.reason ||
        ""
      )
    ).toLowerCase();

    if (explicit.includes("calculation")) return "Calculation Error";
    if (explicit.includes("misread")) return "Misread";
    if (explicit.includes("guess")) return "Wrong Guess";
    if (explicit.includes("time")) return "Time Pressure";
    if (explicit.includes("concept")) return "Concept Gap";

    const t = text(q).toLowerCase();

    if (
      t.includes("calculate") ||
      t.includes("numerical") ||
      t.includes("value of")
    ) {
      return "Calculation Error";
    }

    return "Concept Gap";
  }

  function subject(q) {
    return String(
      q && (
        q.subject ||
        q.section ||
        ""
      )
    ).trim() || "Unknown";
  }

  function topic(q) {
    return String(
      q && (
        q.topic ||
        q.chapter ||
        q.unit ||
        ""
      )
    ).trim() || "Unknown";
  }

  function testId(test) {
    return String(
      test && (
        test.id ||
        test.testId ||
        test.sessionId
      ) || "PDF-CBT"
    );
  }

  function testTitle(test) {
    return String(
      test && (
        test.title ||
        test.testTitle ||
        test.name
      ) || "PDF Module CBT"
    );
  }

  /*
   * Called after CBT result creation.
   * It does NOT replace cbtHistory.
   * It only adds stable PDF identity metadata.
   */
  function enrichHistory() {
    const test = activeTest();
    if (!test) return false;

    const history = read(HISTORY, []);

    if (!Array.isArray(history) || !history.length) return false;

    const last = history[history.length - 1];

    if (!last || typeof last !== "object") return false;

    const qs =
      last.questions ||
      last.questionResults ||
      last.results ||
      last.items ||
      [];

    last.rankForgeFlow = {
      source: "PDF",
      testId: testId(test),
      title: testTitle(test),
      questionCount: Number(
        Array.isArray(qs) && qs.length
          ? qs.length
          : test.questions.length
      ),
      linkedAt: Date.now()
    };

    last.source = last.source || "PDF Import";
    last.sourceType = "pdf";
    last.testId = last.testId || testId(test);
    last.testTitle = last.testTitle || testTitle(test);

    history[history.length - 1] = last;
    write(HISTORY, history.slice(-300));

    return true;
  }

  /*
   * Convert the latest PDF result into the existing
   * RankForge mistake system.
   */
  function syncMistakes() {
    const test = activeTest();
    if (!test || !Array.isArray(test.questions)) return [];

    const history = read(HISTORY, []);
    const latest =
      Array.isArray(history) && history.length
        ? history[history.length - 1]
        : null;

    const resultQuestions =
      latest && (
        latest.questions ||
        latest.questionResults ||
        latest.results ||
        latest.items
      );

    const qs =
      Array.isArray(resultQuestions) && resultQuestions.length
        ? resultQuestions
        : test.questions;

    const store = read(MISTAKES, {});
    const out = [];

    qs.forEach(function (q, i) {
      if (!q || !text(q) || !isWrong(q)) return;

      const qid = id(q, i);
      const key = testId(test) + "::" + qid;

      const item = {
        id: qid,
        questionId: qid,
        question: text(q),
        text: text(q),
        subject: subject(q),
        topic: topic(q),
        reason: classify(q),
        userAnswer: answer(q),
        correctAnswer: correct(q),
        testId: testId(test),
        testTitle: testTitle(test),
        source: "PDF CBT",
        status:
          store[key] && store[key].status === "mastered"
            ? "mastered"
            : "active",
        attempts:
          store[key] && Number(store[key].attempts)
            ? Number(store[key].attempts)
            : 1,
        retries:
          store[key] && Number(store[key].retries)
            ? Number(store[key].retries)
            : 0,
        updatedAt: Date.now()
      };

      store[key] = {
        ...(store[key] || {}),
        ...item
      };

      out.push(store[key]);
    });

    write(MISTAKES, store);

    // Keep the existing Mistake Intelligence page compatible.
    // mistake.html currently reads cbtMistakes as an array.
    const legacy = Object.values(store).map(function (m) {
      return {
        id: m.id,
        questionId: m.questionId,
        question: m.question,
        text: m.text,
        options: Array.isArray(m.options) ? m.options : [],
        subject: m.subject,
        topic: m.topic,
        chapter: m.topic,
        userAnswer: m.userAnswer,
        selectedAnswer: m.userAnswer,
        correctAnswer: m.correctAnswer,
        solution: m.solution || m.explanation || "",
        mistakeType: m.reason || "Concept Gap",
        mistakeReason: m.reason || "Concept Gap",
        source: m.source || "PDF CBT",
        testId: m.testId,
        testTitle: m.testTitle,
        status: m.status || "active",
        updatedAt: m.updatedAt || Date.now()
      };
    });

    write("cbtMistakes", legacy);

    return out;
  }

  function retry(qid) {
    const mistakes = read(MISTAKES, {});
    const item = Object.values(mistakes).find(function (m) {
      return String(m.id) === String(qid) ||
             String(m.questionId) === String(qid);
    });

    if (!item) return false;

    const retryHistory = read(RETRIES, []);

    retryHistory.push({
      ...item,
      action: "retry",
      source: "PDF CBT",
      retryAt: Date.now()
    });

    write(RETRIES, retryHistory.slice(-300));

    const key = Object.keys(mistakes).find(function (k) {
      return mistakes[k] === item;
    });

    if (key) {
      mistakes[key] = {
        ...mistakes[key],
        retries: Number(mistakes[key].retries || 0) + 1,
        lastRetryAt: Date.now()
      };

      write(MISTAKES, mistakes);
    }

    /*
     * Existing CBT can consume this single retry payload.
     */
    write("rankforgeActiveRetryV1", {
      ...item,
      source: "PDF CBT",
      createdAt: Date.now()
    });

    return true;
  }

  function master(qid) {
    const mistakes = read(MISTAKES, {});
    const item = Object.values(mistakes).find(function (m) {
      return String(m.id) === String(qid) ||
             String(m.questionId) === String(qid);
    });

    if (!item) return false;

    const key = Object.keys(mistakes).find(function (k) {
      return mistakes[k] === item;
    });

    if (key) {
      mistakes[key] = {
        ...mistakes[key],
        status: "mastered",
        masteredAt: Date.now(),
        updatedAt: Date.now()
      };

      write(MISTAKES, mistakes);
    }

    const mastery = read(MASTERY, []);
    const list = Array.isArray(mastery) ? mastery : [];

    if (!list.some(function (m) {
      return String(
        typeof m === "string"
          ? m
          : (m.id || m.questionId || m.text || m.question || "")
      ) === String(qid);
    })) {
      list.push({
        id: item.id,
        questionId: item.questionId,
        question: item.question,
        text: item.text,
        topic: item.topic,
        subject: item.subject,
        source: "PDF CBT",
        masteredAt: Date.now()
      });
    }

    write(MASTERY, list.slice(-500));

    return true;
  }

  function stats() {
    const mistakes = Object.values(read(MISTAKES, {}));

    return {
      total: mistakes.length,
      active: mistakes.filter(m => m.status !== "mastered").length,
      mastered: mistakes.filter(m => m.status === "mastered").length,
      pdf: mistakes.filter(m => m.source === "PDF CBT").length
    };
  }

  function boot() {
    window.RankForgePDFResultMasteryV1 = {
      enrichHistory,
      syncMistakes,
      retry,
      master,
      stats
    };

    /*
     * Result page may be loaded after CBT page.
     * Retry a few times without rendering any debug UI.
     */
    enrichHistory();

    setTimeout(function () {
      enrichHistory();
      syncMistakes();
    }, 300);

    setTimeout(function () {
      enrichHistory();
      syncMistakes();
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
