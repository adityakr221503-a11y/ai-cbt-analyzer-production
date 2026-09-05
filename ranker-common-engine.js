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
    activeQuestions: "rbSelectedQuestions"
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

  function getRankerAttempts() {
    return arr(read(KEYS.rankerAttempts, []));
  }

  function getBank() {
    return arr(read(KEYS.rankerBank, []));
  }

  function getMastery() {
    const raw = read(KEYS.mastery, {});
    return Array.isArray(raw) ? raw : object(raw);
  }

  function masteryCount() {
    const raw = getMastery();

    if (Array.isArray(raw)) {
      return raw.length;
    }

    return Object.values(raw).filter(function (x) {
      return x && (x.mastered === true || x.status === "mastered");
    }).length;
  }

  function getMistakes() {
    const attempts = getRankerAttempts();

    return attempts.filter(function (a) {
      return a && (
        a.correct === false ||
        a.isCorrect === false ||
        a.result === "wrong"
      );
    });
  }

  function getAllEvidence() {
    return {
      history: getHistory(),
      rankerAttempts: getRankerAttempts(),
      bank: getBank(),
      mastery: getMastery(),
      mistakes: getMistakes(),
      retryQuestion: read(KEYS.retry, null),
      retryQueue: arr(read(KEYS.retryQueue, []))
    };
  }

  function subjectOf(q) {
    return text(
      q && (
        q.subject ||
        q.section ||
        q.sub ||
        ""
      )
    );
  }

  function chapterOf(q) {
    return text(
      q && (
        q.chapter ||
        q.chapterName ||
        ""
      )
    );
  }

  function topicOf(q) {
    return text(
      q && (
        q.topic ||
        q.topicName ||
        ""
      )
    );
  }

  function conceptOf(q) {
    return text(
      q && (
        q.concept ||
        q.subTopic ||
        q.subtopic ||
        ""
      )
    );
  }

  function getTopicStats() {
    const stats = {};

    getRankerAttempts().forEach(function (a) {
      if (!a) return;

      const subject = subjectOf(a);
      const chapter = chapterOf(a);
      const topic = topicOf(a);
      const concept = conceptOf(a);

      const key = [
        subject,
        chapter,
        topic,
        concept
      ].map(norm).join("|");

      if (!stats[key]) {
        stats[key] = {
          subject: subject,
          chapter: chapter,
          topic: topic,
          concept: concept,
          attempts: 0,
          correct: 0,
          wrong: 0
        };
      }

      stats[key].attempts++;

      if (isCorrect(a)) {
        stats[key].correct++;
      } else {
        stats[key].wrong++;
      }
    });

    return Object.values(stats).map(function (x) {
      x.accuracy = x.attempts
        ? Math.round((x.correct / x.attempts) * 100)
        : 0;

      x.weakness = x.attempts
        ? Math.round((x.wrong / x.attempts) * 100)
        : 0;

      return x;
    }).sort(function (a, b) {
      return b.weakness - a.weakness;
    });
  }

  function getWeakTopics(limit) {
    limit = Number(limit || 10);

    return getTopicStats()
      .filter(function (x) {
        return x.attempts >= 1 && x.accuracy < 70;
      })
      .slice(0, limit);
  }

  function getStrongTopics(limit) {
    limit = Number(limit || 10);

    return getTopicStats()
      .filter(function (x) {
        return x.attempts >= 2 && x.accuracy >= 80;
      })
      .sort(function (a, b) {
        return b.accuracy - a.accuracy;
      })
      .slice(0, limit);
  }

  function getSubjectStats() {
    const stats = {};

    getRankerAttempts().forEach(function (a) {
      const subject = subjectOf(a) || "Unknown";

      if (!stats[subject]) {
        stats[subject] = {
          subject: subject,
          attempts: 0,
          correct: 0,
          wrong: 0
        };
      }

      stats[subject].attempts++;

      if (isCorrect(a)) {
        stats[subject].correct++;
      } else {
        stats[subject].wrong++;
      }
    });

    return Object.values(stats).map(function (x) {
      x.accuracy = x.attempts
        ? Math.round((x.correct / x.attempts) * 100)
        : 0;

      return x;
    });
  }

  function getOverallAccuracy() {
    const attempts = getRankerAttempts();

    if (!attempts.length) return null;

    const correct = attempts.filter(isCorrect).length;

    return Math.round((correct / attempts.length) * 100);
  }

  function getLatestHistory() {
    const h = getHistory();

    return h.length ? h[h.length - 1] : null;
  }

  function getLatestScore() {
    const h = getHistory();

    for (let i = h.length - 1; i >= 0; i--) {
      const x = h[i] || {};

      const value =
        x.score ??
        x.marks ??
        x.totalScore ??
        x.totalMarks ??
        x.percentage;

      if (value !== undefined && value !== null && value !== "") {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
      }
    }

    return null;
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
