
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
