/* =========================================================
   CBT ANALYZER PRO — COMMON DATA / DECISION ENGINE
   v1
   Preserve existing storage. Read-only analytics layer.
   ========================================================= */
(function () {
  "use strict";

  const KEYS = {
    history: "cbtHistory",
    rankerAttempts: "rankBoosterAttemptHistory",
    rankerBank: "rankBoosterQuestionBankV1",
    mastery: "cbtMasteryV2",
    retry: "cbtRetryQuestion",
    retryQueue: "cbtAnalyzer.retryQueue",
    activeQuestions: "rbSelectedQuestions",
    testSessions: "cbtTestSessions"
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === "") return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function object(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function norm(value) {
    return text(value).toLowerCase();
  }

  function questionId(q, index) {
    q = q || {};
    return text(
      q.questionId ||
      q.id ||
      q._id ||
      q.question ||
      ("q-" + index)
    );
  }

  function selectedAnswer(q) {
    q = q || {};
    return q.selectedAnswer ??
      q.userAnswer ??
      q.answerSelected ??
      q.selected ??
      q.user_answer ??
      null;
  }

  function correctAnswer(q) {
    q = q || {};
    return q.correctAnswer ??
      q.correctOption ??
      q.correct_answer ??
      q.correct ??
      q.answer ??
      null;
  }

  function isCorrect(q) {
    if (q && typeof q.isCorrect === "boolean") {
      return q.isCorrect;
    }

    const a = selectedAnswer(q);
    const c = correctAnswer(q);

    if (a === null || a === "" || c === null || c === "") {
      return false;
    }

    return norm(a) === norm(c);
  }

  function getHistory() {
    return arr(read(KEYS.history, []));
  }

  function getTestSessions() {
    return arr(read(KEYS.testSessions, []));
  }

  function getLatestSession() {
    const sessions = getTestSessions();
    return sessions.length ? sessions[sessions.length - 1] : null;
  }


  function getNextBestAction() {
    const weak = getWeakTopics(3);
    const mistakes = getMistakes();

    if (weak.length) {
      const w = weak[0];

      return {
        type: "WEAK_TOPIC",
        title: "Target weak topic",
        reason:
          (w.topic || w.chapter || w.subject || "Weak area") +
          " has " + w.accuracy + "% accuracy.",
        data: w
      };
    }

    if (mistakes.length) {
      return {
        type: "MISTAKE_REVIEW",
        title: "Review mistakes",
        reason:
          mistakes.length +
          " wrong attempt record(s) need review/retry.",
        data: mistakes[0]
      };
    }

    if (getBank().length) {
      return {
        type: "RANKER_TEST",
        title: "Start Ranker Practice",
        reason: "Use the available Ranker Question Bank.",
        data: null
      };
    }

    return {
      type: "DIAGNOSTIC",
      title: "Create diagnostic evidence",
      reason: "No meaningful attempt evidence is available yet.",
      data: null
    };
  }

  function get720Gap() {
    const latest = getLatestScore();

    return {
      target: 720,
      current: latest,
      gap: latest === null ? null : Math.max(0, 720 - latest)
    };
  }

  function getSnapshot() {
    const evidence = getAllEvidence();

    return {
      counts: {
        tests: evidence.history.length,
        rankerQuestions: evidence.bank.length,
        rankerAttempts: evidence.rankerAttempts.length,
        mistakes: evidence.mistakes.length,
        mastered: masteryCount(),
        retryQueue: evidence.retryQueue.length
      },

      accuracy: getOverallAccuracy(),

      score: get720Gap(),

      latestHistory: getLatestHistory(),

      latestSession: getLatestSession(),

      sessionStats: getSessionStats(),

      weakTopics: getWeakTopics(10),

      strongTopics: getStrongTopics(10),

      subjectStats: getSubjectStats(),

      nextBestAction: getNextBestAction(),

      sources: {
        ranker: evidence.rankerAttempts.length > 0,
        pdf: evidence.history.some(function (x) {
          return norm(
            x.source ||
            x.testSource ||
            x.testType ||
            ""
          ).includes("pdf");
        }),
        rankersSeries: evidence.history.some(function (x) {
          return norm(
            x.source ||
            x.testSource ||
            x.testType ||
            ""
          ).includes("ranker");
        })
      }
    };
  }

  window.CBTAnalyzerCore = {
    version: "1.0.0",
    keys: KEYS,
    read: read,
    getHistory: getHistory,
    getTestSessions: getTestSessions,
    getLatestSession: getLatestSession,
    saveTestSession: saveTestSession,
    getSessionStats: getSessionStats,
    getRankerAttempts: getRankerAttempts,
    getBank: getBank,
    getMastery: getMastery,
    getMistakes: getMistakes,
    getAllEvidence: getAllEvidence,
    masteryCount: masteryCount,
    getTopicStats: getTopicStats,
    getWeakTopics: getWeakTopics,
    getStrongTopics: getStrongTopics,
    getSubjectStats: getSubjectStats,
    getOverallAccuracy: getOverallAccuracy,
    getLatestHistory: getLatestHistory,
    getLatestScore: getLatestScore,
    getNextBestAction: getNextBestAction,
    get720Gap: get720Gap,
    getSnapshot: getSnapshot
  };

  window.dispatchEvent(
    new CustomEvent("cbt:core-ready")
  );
})();
