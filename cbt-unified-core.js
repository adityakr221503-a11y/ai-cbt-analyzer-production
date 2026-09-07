/* =========================================================
   CBT ANALYZER — UNIFIED CUMULATIVE CORE
   Preserves existing features; additive integration only.
========================================================= */
(function () {
  "use strict";

  const K = {
    HISTORY: "cbtHistory",
    MASTERY: "cbtMasteryV2",
    MISTAKES: "cbtMistakeBankV2",
    RETRY: "cbtRetryQuestion",
    MENTOR: "cbtMentorV1",
    ATTEMPTS: "cbtAttemptsV1"
  };

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
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

  function arr(key) {
    const v = read(key, []);
    return Array.isArray(v) ? v : [];
  }

  function questionId(q, index) {
    return String(
      q?.id ??
      q?.questionId ??
      q?.qid ??
      q?.question ??
      ("q-" + index)
    ).trim();
  }

  function normalizeAnswer(q) {
    return String(
      q?.correctAnswer ??
      q?.answer ??
      q?.correct ??
      ""
    ).trim();
  }

  function recordAttempt(payload) {
    const attempts = arr(K.ATTEMPTS);

    attempts.push({
      id: "attempt-" + Date.now(),
      timestamp: new Date().toISOString(),
      score: Number(payload?.score ?? 0),
      total: Number(payload?.total ?? 0),
      correct: Number(payload?.correct ?? 0),
      wrong: Number(payload?.wrong ?? 0),
      skipped: Number(payload?.skipped ?? 0),
      source: payload?.source || "CBT",
      testName: payload?.testName || "CBT Test"
    });

    write(K.ATTEMPTS, attempts.slice(-500));
  }

  function recordMistake(q, selectedAnswer, index, reason) {
    if (!q) return;

    const id = questionId(q, index);
    const mistakes = arr(K.MISTAKES);

    const existing = mistakes.find(x => String(x.id) === id);

    if (existing) {
      existing.lastSeen = new Date().toISOString();
      existing.attempts = Number(existing.attempts || 0) + 1;
      existing.selectedAnswer = selectedAnswer ?? existing.selectedAnswer;
      if (reason) existing.mistakeReason = reason;
    } else {
      mistakes.push({
        id,
        question: q.question || q.text || "",
        subject: q.subject || "",
        topic: q.topic || q.chapter || "",
        selectedAnswer: selectedAnswer ?? "",
        correctAnswer: normalizeAnswer(q),
        mistakeReason: reason || "Not classified",
        attempts: 1,
        mastered: false,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });
    }

    write(K.MISTAKES, mistakes.slice(-2000));
  }

  function markMastered(q, index) {
    if (!q) return;

    const id = questionId(q, index);
    const mastery = arr(K.MASTERY);

    let item = mastery.find(x => String(x.id) === id);

    if (!item) {
      item = {
        id,
        question: q.question || q.text || "",
        subject: q.subject || "",
        topic: q.topic || q.chapter || "",
        retryCorrect: 0,
        mastered: false
      };
      mastery.push(item);
    }

    item.retryCorrect = Number(item.retryCorrect || 0) + 1;

    // Existing project rule: real retry correct => mastered.
    if (item.retryCorrect >= 1) item.mastered = true;

    write(K.MASTERY, mastery.slice(-2000));

    const mistakes = arr(K.MISTAKES);
    const m = mistakes.find(x => String(x.id) === id);

    if (m && item.mastered) {
      m.mastered = true;
      m.masteredAt = new Date().toISOString();
    }

    write(K.MISTAKES, mistakes);
  }

  function setRetry(q) {
    if (!q) return false;
    return write(K.RETRY, q);
  }

  function mentorSnapshot() {
    const attempts = arr(K.ATTEMPTS);
    const mistakes = arr(K.MISTAKES);
    const mastery = arr(K.MASTERY);

    const topicMap = {};

    mistakes
      .filter(x => !x.mastered)
      .forEach(x => {
        const topic = x.topic || "Unknown";
        topicMap[topic] = (topicMap[topic] || 0) + 1;
      });

    const weakTopics = Object.entries(topicMap)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, mistakes]) => ({ topic, mistakes }));

    const latest = attempts[attempts.length - 1] || null;

    const snapshot = {
      updatedAt: new Date().toISOString(),
      totalAttempts: attempts.length,
      activeMistakes: mistakes.filter(x => !x.mastered).length,
      mastered: mastery.filter(x => x.mastered).length,
      weakTopics,
      latestAttempt: latest,
      nextAction:
        weakTopics.length
          ? "Retry questions from " + weakTopics[0].topic
          : "Take a new Ranker test"
    };

    write(K.MENTOR, snapshot);
    return snapshot;
  }

  window.CBTAnalyzerCore = {
    recordAttempt,
    recordMistake,
    markMastered,
    setRetry,
    mentorSnapshot,
    getStats: mentorSnapshot
  };

  // Safe event bridge. Existing application logic remains untouched.
  document.addEventListener("cbt:attempt-complete", e => {
    recordAttempt(e.detail || {});
    mentorSnapshot();
  });

  document.addEventListener("cbt:mistake", e => {
    const d = e.detail || {};
    recordMistake(d.question, d.selectedAnswer, d.index, d.reason);
    mentorSnapshot();
  });

  document.addEventListener("cbt:retry-correct", e => {
    const d = e.detail || {};
    markMastered(d.question, d.index);
    mentorSnapshot();
  });

  // Make the unified state available immediately.
  mentorSnapshot();
})();
