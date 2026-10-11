
/* =========================================================
   CBT ANALYZER PRO — ORBIT / POST-TEST ANALYSIS ENGINE
   Additive layer
   ========================================================= */
(function () {
  "use strict";

  const SESSION_KEY = "cbtTestSessions";
  const RETRY_KEY = "cbtAnalyzer.retryQueue";
  const MASTERY_KEY = "cbtMasteryV2";

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function obj(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  }

  function text(v) {
    return String(v == null ? "" : v).trim();
  }

  function norm(v) {
    return text(v).toLowerCase();
  }

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function sessions() {
    return arr(read(SESSION_KEY, []));
  }

  function latest() {
    const s = sessions();
    return s.length ? s[s.length - 1] : null;
  }

  function safeNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function durationSeconds(s) {
    const started = Date.parse(s && s.startedAt);
    const ended = Date.parse(s && s.submittedAt);

    if (Number.isFinite(started) && Number.isFinite(ended) && ended >= started) {
      return Math.round((ended - started) / 1000);
    }

    return safeNumber(s && s.durationSeconds, 0);
  }

  function accuracy(s) {
    if (!s) return 0;

    if (s.accuracy != null) {
      return Math.max(0, Math.min(100, safeNumber(s.accuracy, 0)));
    }

    const answered = safeNumber(s.answered, 0);
    const correct = safeNumber(s.correct, 0);

    return answered ? (correct / answered) * 100 : 0;
  }

  function speed(s) {
    if (!s) return 0;

    const seconds = durationSeconds(s);
    const answered = safeNumber(s.answered, 0);

    if (!seconds || !answered) return 0;

    return answered / (seconds / 60);
  }

  function score(s) {
    return safeNumber(
      s && (s.score != null ? s.score : s.marks),
      0
    );
  }

  function percentage(s) {
    if (!s) return 0;

    if (s.percentage != null) {
      return safeNumber(s.percentage, 0);
    }

    const max = safeNumber(
      s.maximumScore != null ? s.maximumScore : s.maxScore,
      0
    );

    return max ? (score(s) / max) * 100 : 0;
  }

  function classify(s) {
    if (!s) return "NO_DATA";

    const a = accuracy(s);
    const p = percentage(s);
    const sp = speed(s);

    if (a >= 85 && p >= 85) return "STRONG";
    if (a >= 75 && p >= 70) return "STABLE";
    if (a >= 60) return "IMPROVABLE";
    if (sp > 0 && a < 60) return "ACCURACY_RISK";

    return "NEEDS_DIAGNOSIS";
  }

  function weakSignals(s) {
    if (!s) return [];

    const out = [];

    if (accuracy(s) < 70) {
      out.push({
        type: "ACCURACY",
        severity: "HIGH",
        title: "Accuracy bottleneck",
        reason: "Too many answered questions are not converting into correct answers."
      });
    }

    if (safeNumber(s.skipped, 0) > safeNumber(s.totalQuestions, 0) * 0.15) {
      out.push({
        type: "SKIPPED",
        severity: "MEDIUM",
        title: "High skip rate",
        reason: "A significant portion of the test was left unanswered."
      });
    }

    if (speed(s) > 0 && speed(s) < 1) {
      out.push({
        type: "SPEED",
        severity: "MEDIUM",
        title: "Speed bottleneck",
        reason: "Answered-question throughput is low."
      });
    }

    if (safeNumber(s.wrong, 0) > safeNumber(s.correct, 0)) {
      out.push({
        type: "WRONG",
        severity: "HIGH",
        title: "Wrong-answer load",
        reason: "Wrong answers currently exceed correct answers."
      });
    }

    return out;
  }

  function build(s) {
    if (!s) {
      return {
        available: false,
        message: "No completed CBT test session is available yet."
      };
    }

    const d = durationSeconds(s);
    const result = {
      available: true,
      sessionId: s.id || null,
      testId: s.testId || null,
      title: s.title || "CBT Test",
      source: s.source || "CBT",
      testType: s.testType || "STANDARD",

      score: score(s),
      maximumScore: safeNumber(s.maximumScore, 0),
      percentage: percentage(s),

      totalQuestions: safeNumber(s.totalQuestions, 0),
      answered: safeNumber(s.answered, 0),
      correct: safeNumber(s.correct, 0),
      wrong: safeNumber(s.wrong, 0),
      skipped: safeNumber(s.skipped, 0),

      accuracy: accuracy(s),
      durationSeconds: d,
      speedQuestionsPerMinute: speed(s),

      classification: classify(s),
      weakSignals: weakSignals(s),

      questionIds: arr(s.questionIds),
      startedAt: s.startedAt || null,
      submittedAt: s.submittedAt || null
    };

    result.nextAction = nextAction(result);

    return result;
  }

  function nextAction(r) {
    if (!r || !r.available) {
      return {
        type: "DIAGNOSTIC",
        title: "Take a diagnostic test"
      };
    }

    if (r.accuracy < 60) {
      return {
        type: "CONCEPT_REPAIR",
        title: "Repair weak concepts first",
        reason: "Accuracy is the current primary bottleneck."
      };
    }

    if (r.skipped > r.totalQuestions * 0.15) {
      return {
        type: "ATTEMPT_STRATEGY",
        title: "Review Skip / Attempt Strategy",
        reason: "Too many questions were left unanswered."
      };
    }

    if (r.speedQuestionsPerMinute > 0 &&
        r.speedQuestionsPerMinute < 1) {
      return {
        type: "SPEED",
        title: "Do targeted speed practice",
        reason: "Question throughput is currently low."
      };
    }

    if (r.wrong > r.correct) {
      return {
        type: "MISTAKE_REVIEW",
        title: "Review mistakes and retry",
        reason: "Wrong answers exceed correct answers."
      };
    }

    return {
      type: "NEXT_TEST",
      title: "Continue to the next adaptive test",
      reason: "Current test evidence does not show a critical bottleneck."
    };
  }

  function getOrbitReport(session) {
    return build(session || latest());
  }

  function getHistoryReports() {
    return sessions().map(build);
  }

  function getRetryQueue() {
    return arr(read(RETRY_KEY, []));
  }

  function getMastery() {
    return obj(read(MASTERY_KEY, {}));
  }

  function getOrbitSnapshot() {
    const report = getOrbitReport();

    return {
      latest: report,
      testCount: sessions().length,
      retryCount: getRetryQueue().length,
      masteryCount: Object.keys(getMastery()).length,
      generatedAt: new Date().toISOString()
    };
  }

  window.CBTAnalyzerOrbit = {
    version: "1.0.0",
    getLatestSession: latest,
    getOrbitReport,
    getHistoryReports,
    getOrbitSnapshot,
    classify,
    nextAction
  };

  window.dispatchEvent(
    new CustomEvent("cbt:orbit-ready")
  );
})();


/* =========================================================
   ORBIT_RECOVERY_ENGINE_V1
   Orbit → Mistake Bank → Retry → Mastery
   ========================================================= */
(function () {
  "use strict";

  const HISTORY_KEY = "cbtHistory";
  const MISTAKE_KEY = "rankBoosterAttemptHistory";
  const RETRY_KEY = "cbtRetryQuestion";
  const QUEUE_KEY = "cbtAnalyzer.retryQueue";
  const MASTERY_KEY = "cbtMasteryV2";
  const RECOVERY_KEY = "cbtOrbitRecovery";

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function obj(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function text(v) {
    return String(v == null ? "" : v).trim();
  }

  function norm(v) {
    return text(v).toLowerCase();
  }

  function qid(q, index) {
    q = q || {};
    return text(
      q.questionId ||
      q.id ||
      q._id ||
      q.question ||
      ("q-" + index)
    );
  }

  function selected(q) {
    q = q || {};
    return q.selectedAnswer ??
      q.userAnswer ??
      q.answerSelected ??
      q.selected ??
      q.user_answer ??
      null;
  }

  function correct(q) {
    q = q || {};
    return q.correctAnswer ??
      q.correctOption ??
      q.correct_answer ??
      q.correct ??
      q.answer ??
      null;
  }

  function isCorrect(q) {
    if (typeof q.isCorrect === "boolean") return q.isCorrect;

    const a = selected(q);
    const c = correct(q);

    if (a === null || a === "" || c === null || c === "") {
      return false;
    }

    return norm(a) === norm(c);
  }

  function questionRecords() {
    const history = arr(read(HISTORY_KEY, []));
    const attempts = arr(read(MISTAKE_KEY, []));

    return history.concat(attempts);
  }

  function getLatestMistakes() {
    const all = questionRecords();
    const map = new Map();

    all.forEach(function (q, index) {
      const id = qid(q, index);

      if (!id) return;

      if (!isCorrect(q)) {
        map.set(id, {
          id: id,
          questionId: id,
          question: q.question || q.text || "",
          subject: q.subject || "",
          chapter: q.chapter || "",
          topic: q.topic || "",
          concept: q.concept || "",
          selectedAnswer: selected(q),
          correctAnswer: correct(q),
          solution:
            q.solution ||
            q.explanation ||
            q.answerExplanation ||
            "",
          mistakeType:
            q.mistakeType ||
            q.mistakeReason ||
            "Unclassified",
          source:
            q.source ||
            q.testSource ||
            q.testType ||
            "CBT",
          timestamp:
            q.timestamp ||
            q.attemptedAt ||
            q.createdAt ||
            new Date().toISOString()
        });
      }
    });

    return Array.from(map.values());
  }

  function classifyMistake(q) {
    q = q || {};

    if (q.mistakeType) return q.mistakeType;
    if (q.mistakeReason) return q.mistakeReason;

    if (
      q.timeTaken != null &&
      Number(q.timeTaken) > 120
    ) {
      return "Time Pressure";
    }

    if (
      q.selectedAnswer != null &&
      q.correctAnswer != null &&
      norm(q.selectedAnswer) !== norm(q.correctAnswer)
    ) {
      return "Concept Gap";
    }

    return "Unclassified";
  }

  function buildRecoveryQueue() {
    const mistakes = getLatestMistakes();

    return mistakes.map(function (q) {
      return {
        questionId: q.questionId,
        question: q.question,
        subject: q.subject,
        chapter: q.chapter,
        topic: q.topic,
        concept: q.concept,
        selectedAnswer: q.selectedAnswer,
        correctAnswer: q.correctAnswer,
        solution: q.solution,
        mistakeType: classifyMistake(q),
        source: q.source,
        status: "pending",
        retryCount: 0,
        masteryStatus: "not-mastered",
        createdAt: q.timestamp
      };
    });
  }

  function syncRecovery() {
    const existing = arr(read(QUEUE_KEY, []));
    const incoming = buildRecoveryQueue();

    const map = new Map();

    existing.forEach(function (x) {
      if (x && x.questionId) {
        map.set(String(x.questionId), x);
      }
    });

    incoming.forEach(function (x) {
      if (!x.questionId) return;

      const old = map.get(String(x.questionId));

      if (old) {
        map.set(String(x.questionId), {
          ...old,
          ...x,
          retryCount: old.retryCount || 0,
          status: old.status || "pending",
          masteryStatus:
            old.masteryStatus || "not-mastered"
        });
      } else {
        map.set(String(x.questionId), x);
      }
    });

    const queue = Array.from(map.values());

    write(QUEUE_KEY, queue);
    write(RECOVERY_KEY, {
      generatedAt: new Date().toISOString(),
      pending: queue.filter(x => x.status !== "mastered").length,
      mastered: queue.filter(
        x => x.masteryStatus === "mastered"
      ).length,
      items: queue
    });

    return queue;
  }

  function getRecoveryQueue() {
    return arr(read(QUEUE_KEY, []));
  }

  function getPendingRecovery() {
    return getRecoveryQueue().filter(function (x) {
      return x.status !== "mastered" &&
             x.masteryStatus !== "mastered";
    });
  }

  function sendToRetry(item) {
    if (!item) return false;

    const retry = {
      ...item,
      retryStartedAt: new Date().toISOString()
    };

    write(RETRY_KEY, retry);

    window.location.href = "./retry.html";
    return true;
  }

  function markRetryCorrect(questionId) {
    const queue = getRecoveryQueue();

    const updated = queue.map(function (x) {
      if (String(x.questionId) !== String(questionId)) {
        return x;
      }

      return {
        ...x,
        retryCount: Number(x.retryCount || 0) + 1,
        status: "mastered",
        masteryStatus: "mastered",
        masteredAt: new Date().toISOString()
      };
    });

    write(QUEUE_KEY, updated);

    const mastery = obj(read(MASTERY_KEY, {}));
    mastery[String(questionId)] = {
      questionId: questionId,
      mastered: true,
      masteredAt: new Date().toISOString()
    };

    write(MASTERY_KEY, mastery);

    write(RECOVERY_KEY, {
      generatedAt: new Date().toISOString(),
      pending: updated.filter(
        x => x.masteryStatus !== "mastered"
      ).length,
      mastered: updated.filter(
        x => x.masteryStatus === "mastered"
      ).length,
      items: updated
    });

    return true;
  }

  function getRecoveryStats() {
    const q = getRecoveryQueue();

    const stats = {
      total: q.length,
      pending: 0,
      mastered: 0,
      conceptGap: 0,
      calculationError: 0,
      misread: 0,
      guessing: 0,
      timePressure: 0,
      unclassified: 0
    };

    q.forEach(function (x) {
      if (x.masteryStatus === "mastered") {
        stats.mastered++;
      } else {
        stats.pending++;
      }

      const t = norm(x.mistakeType);

      if (t.includes("concept")) stats.conceptGap++;
      else if (t.includes("calculation")) stats.calculationError++;
      else if (t.includes("misread")) stats.misread++;
      else if (t.includes("guess")) stats.guessing++;
      else if (t.includes("time")) stats.timePressure++;
      else stats.unclassified++;
    });

    return stats;
  }

  window.CBTAnalyzerRecovery = {
    version: "1.0.0",
    syncRecovery,
    getRecoveryQueue,
    getPendingRecovery,
    getRecoveryStats,
    sendToRetry,
    markRetryCorrect
  };

  window.dispatchEvent(
    new CustomEvent("cbt:recovery-ready")
  );
})();



/* =========================================================
   ORBIT_RECOVERY_V2
   Post-Test → Mistake → Retry → Mastery
   Additive / preserves existing storage
   ========================================================= */
(function () {
  "use strict";

  const KEYS = {
    history: "cbtHistory",
    rankerAttempts: "rankBoosterAttemptHistory",
    retry: "cbtRetryQuestion",
    retryQueue: "cbtAnalyzer.retryQueue",
    mastery: "cbtMasteryV2",
    recovery: "cbtOrbitRecoveryV2"
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function text(v) {
    return String(v == null ? "" : v).trim();
  }

  function norm(v) {
    return text(v).toLowerCase();
  }

  function idOf(q, index) {
    q = q || {};

    return text(
      q.questionId ||
      q.id ||
      q._id ||
      q.question ||
      ("q-" + index)
    );
  }

  function selectedOf(q) {
    q = q || {};

    return q.selectedAnswer ??
      q.userAnswer ??
      q.answerSelected ??
      q.selected ??
      q.user_answer ??
      null;
  }

  function correctOf(q) {
    q = q || {};

    return q.correctAnswer ??
      q.correctOption ??
      q.correct_answer ??
      q.correct ??
      q.answer ??
      null;
  }

  function resultOf(q) {
    if (q && typeof q.isCorrect === "boolean") {
      return q.isCorrect;
    }

    const a = selectedOf(q);
    const c = correctOf(q);

    if (
      a === null ||
      a === "" ||
      c === null ||
      c === ""
    ) {
      return false;
    }

    return norm(a) === norm(c);
  }

  function classify(q) {
    q = q || {};

    const explicit =
      q.mistakeType ||
      q.mistakeReason ||
      q.reason ||
      "";

    if (explicit) return explicit;

    if (
      q.timeTaken != null &&
      Number(q.timeTaken) >= 120
    ) {
      return "Time Pressure";
    }

    if (
      q.selectedAnswer != null &&
      q.correctAnswer != null &&
      norm(q.selectedAnswer) !== norm(q.correctAnswer)
    ) {
      return "Concept Gap";
    }

    return "Unclassified";
  }

  function collect() {

    const sources = [
      ...arr(read(KEYS.rankerAttempts, [])),
      ...arr(read(KEYS.history, []))
    ];

    const map = new Map();

    sources.forEach(function (q, index) {

      if (!q || resultOf(q)) return;

      const id = idOf(q, index);

      if (!id) return;

      const record = {
        questionId: id,
        id: id,

        question:
          q.question ||
          q.text ||
          q.questionText ||
          "",

        subject: q.subject || "",
        chapter: q.chapter || "",
        topic: q.topic || "",
        concept: q.concept || "",

        selectedAnswer: selectedOf(q),
        correctAnswer: correctOf(q),

        solution:
          q.solution ||
          q.explanation ||
          q.answerExplanation ||
          "",

        mistakeType: classify(q),

        source:
          q.source ||
          q.testSource ||
          q.testType ||
          "CBT",

        attemptedAt:
          q.attemptedAt ||
          q.timestamp ||
          new Date().toISOString()
      };

      map.set(id, record);
    });

    return Array.from(map.values());
  }

  function getQueue() {
    return arr(read(KEYS.retryQueue, []));
  }

  function sync() {

    const existing = getQueue();
    const mistakes = collect();

    const map = new Map();

    existing.forEach(function (item) {
      if (
        item &&
        item.questionId
      ) {
        map.set(
          String(item.questionId),
          item
        );
      }
    });

    mistakes.forEach(function (item) {

      const key = String(item.questionId);
      const old = map.get(key);

      if (old) {

        map.set(key, {
          ...old,

          question:
            item.question || old.question,

          subject:
            item.subject || old.subject,

          chapter:
            item.chapter || old.chapter,

          topic:
            item.topic || old.topic,

          concept:
            item.concept || old.concept,

          selectedAnswer:
            item.selectedAnswer,

          correctAnswer:
            item.correctAnswer,

          solution:
            item.solution || old.solution,

          mistakeType:
            item.mistakeType || old.mistakeType,

          source:
            item.source || old.source
        });

      } else {

        map.set(key, {
          ...item,

          status: "pending",
          retryCount: 0,
          masteryStatus: "not-mastered"
        });

      }
    });

    const queue = Array.from(map.values());

    write(KEYS.retryQueue, queue);

    write(KEYS.recovery, {
      version: 2,

      generatedAt:
        new Date().toISOString(),

      total: queue.length,

      pending:
        queue.filter(function (x) {
          return x.masteryStatus !== "mastered";
        }).length,

      mastered:
        queue.filter(function (x) {
          return x.masteryStatus === "mastered";
        }).length,

      items: queue
    });

    return queue;
  }

  function pending() {
    return sync().filter(function (x) {
      return (
        x.status !== "mastered" &&
        x.masteryStatus !== "mastered"
      );
    });
  }

  function stats() {

    const queue = sync();

    const out = {
      total: queue.length,
      pending: 0,
      mastered: 0,

      conceptGap: 0,
      calculationError: 0,
      misreadQuestion: 0,
      guessing: 0,
      timePressure: 0,
      unclassified: 0
    };

    queue.forEach(function (x) {

      if (
        x.masteryStatus === "mastered"
      ) {
        out.mastered++;
      } else {
        out.pending++;
      }

      const t =
        norm(x.mistakeType);

      if (t.includes("concept")) {
        out.conceptGap++;
      }
      else if (t.includes("calculation")) {
        out.calculationError++;
      }
      else if (
        t.includes("misread")
      ) {
        out.misreadQuestion++;
      }
      else if (
        t.includes("guess")
      ) {
        out.guessing++;
      }
      else if (
        t.includes("time")
      ) {
        out.timePressure++;
      }
      else {
        out.unclassified++;
      }
    });

    return out;
  }

  function retry(item) {

    if (!item) return false;

    const retryQuestion = {
      ...item,

      retryStartedAt:
        new Date().toISOString()
    };

    write(
      KEYS.retry,
      retryQuestion
    );

    window.location.href =
      "./retry.html";

    return true;
  }

  function markMastered(questionId) {

    const queue = getQueue();

    const updated =
      queue.map(function (item) {

        if (
          String(item.questionId) !==
          String(questionId)
        ) {
          return item;
        }

        return {
          ...item,

          status: "mastered",

          masteryStatus:
            "mastered",

          retryCount:
            Number(item.retryCount || 0) + 1,

          masteredAt:
            new Date().toISOString()
        };
      });

    write(
      KEYS.retryQueue,
      updated
    );

    const mastery =
      read(KEYS.mastery, {});

    mastery[String(questionId)] = {
      questionId: questionId,
      mastered: true,
      masteredAt:
        new Date().toISOString()
    };

    write(
      KEYS.mastery,
      mastery
    );

    sync();

    return true;
  }

  window.CBTAnalyzerRecovery = {
    version: "2.0.0",
    sync: sync,
    getQueue: getQueue,
    pending: pending,
    stats: stats,
    retry: retry,
    markMastered: markMastered
  };

  window.dispatchEvent(
    new CustomEvent(
      "cbt:recovery-ready"
    )
  );

})();
