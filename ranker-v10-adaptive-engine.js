/* =========================================================
   RANKER V10 — PERFORMANCE + RECOVERY + MASTERY + ADAPTIVE
   ADDITIVE ONLY
   V8 lifecycle preserved, premature POST prevented
========================================================= */
(function () {
  "use strict";

  const K = {
    trend: "cbtPerformanceTrendV10",
    recovery: "cbtWeakTopicRecoveryV10",
    mastery: "cbtVerifiedMasteryV10",
    adaptive: "cbtAdaptiveNextTestV10",

    lifecycle: "cbtRankerLifecycleV8",
    evidenceV9: "cbtQuestionEvidenceV9",
    behaviorV9: "cbtBehaviorAnalysisV9",
    postV8: "cbtPostTestStateV8",

    history: "cbtHistory",
    sessions: "cbtTestSessions",
    retry: "cbtAnalyzer.retryQueue",
    masteryLegacy: "cbtMasteryV2",

    mentor: "cbtMentorStateV5",
    orbit: "cbtOrbitStateV5",
    next: "cbtNextBestActionV5"
  };

  function read(k, fallback) {
    try {
      const v = JSON.parse(
        localStorage.getItem(k) || "null"
      );
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function write(k, v) {
    try {
      localStorage.setItem(
        k,
        JSON.stringify(v)
      );
    } catch (_) {}
  }

  function arr(k) {
    const v = read(k, []);
    return Array.isArray(v) ? v : [];
  }

  function norm(v) {
    return String(v == null ? "" : v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function now() {
    return Date.now();
  }

  /* =====================================================
     RESULT RESOLUTION
  ===================================================== */

  function latest(list) {
    return list.length
      ? list[list.length - 1]
      : null;
  }

  function getLatestEvidence() {
    const v9 =
      read(K.evidenceV9, null);

    if (
      v9 &&
      Array.isArray(v9.questions) &&
      v9.questions.length
    ) {
      return v9.questions;
    }

    const post =
      read(K.postV8, null);

    if (
      post &&
      Array.isArray(post.questions)
    ) {
      return post.questions;
    }

    return [];
  }

  function getLatestResult() {
    const history =
      arr(K.history);

    const sessions =
      arr(K.sessions);

    const h = latest(history);
    const s = latest(sessions);

    return h || s || null;
  }

  /* =====================================================
     1. PERFORMANCE TREND
  ===================================================== */

  function extractPerformance(item) {
    if (!item || typeof item !== "object")
      return null;

    const score =
      Number(
        item.score ??
        item.marks ??
        item.totalScore
      );

    const percentage =
      Number(
        item.percentage ??
        item.percent
      );

    const accuracy =
      Number(
        item.accuracy
      );

    const total =
      Number(
        item.totalQuestions ??
        item.total
      );

    const correct =
      Number(
        item.correct
      );

    const wrong =
      Number(
        item.wrong
      );

    const skipped =
      Number(
        item.skipped
      );

    const speed =
      Number(
        item.speed ??
        item.questionsPerMinute ??
        0
      );

    return {
      id:
        item.id ||
        item.sessionId ||
        null,

      timestamp:
        item.submittedAt ||
        item.completedAt ||
        item.createdAt ||
        item.startedAt ||
        now(),

      score:
        Number.isFinite(score)
          ? score
          : null,

      percentage:
        Number.isFinite(percentage)
          ? percentage
          : null,

      accuracy:
        Number.isFinite(accuracy)
          ? accuracy
          : null,

      total:
        Number.isFinite(total)
          ? total
          : null,

      correct:
        Number.isFinite(correct)
          ? correct
          : null,

      wrong:
        Number.isFinite(wrong)
          ? wrong
          : null,

      skipped:
        Number.isFinite(skipped)
          ? skipped
          : null,

      speed:
        Number.isFinite(speed)
          ? speed
          : 0
    };
  }

  function buildTrend() {
    const history =
      arr(K.history);

    const sessions =
      arr(K.sessions);

    const combined =
      history.concat(sessions);

    const unique = [];
    const seen = new Set();

    combined.forEach(function (x) {
      const p =
        extractPerformance(x);

      if (!p) return;

      const key =
        p.id ||
        String(p.timestamp);

      if (seen.has(key)) return;

      seen.add(key);
      unique.push(p);
    });

    unique.sort(
      (a, b) =>
        Number(a.timestamp) -
        Number(b.timestamp)
    );

    const recent =
      unique.slice(-10);

    function delta(field) {
      if (recent.length < 2)
        return 0;

      const a =
        Number(
          recent[recent.length - 2][field]
        ) || 0;

      const b =
        Number(
          recent[recent.length - 1][field]
        ) || 0;

      return Math.round((b - a) * 10) / 10;
    }

    const trend = {
      version: "V10",

      tests: recent,

      latest:
        latest(recent),

      deltas: {
        score: delta("score"),
        percentage: delta("percentage"),
        accuracy: delta("accuracy"),
        speed: delta("speed")
      },

      direction: {
        score:
          delta("score") > 0
            ? "UP"
            : delta("score") < 0
            ? "DOWN"
            : "STABLE",

        accuracy:
          delta("accuracy") > 0
            ? "UP"
            : delta("accuracy") < 0
            ? "DOWN"
            : "STABLE",

        speed:
          delta("speed") > 0
            ? "UP"
            : delta("speed") < 0
            ? "DOWN"
            : "STABLE"
      },

      generatedAt: now()
    };

    write(K.trend, trend);
    return trend;
  }

  /* =====================================================
     2. WEAK TOPIC RECOVERY
  ===================================================== */

  function buildTopicRecovery() {
    const evidence =
      getLatestEvidence();

    const map = {};

    evidence.forEach(function (q) {
      const subject =
        q.subject || "Unknown";

      const chapter =
        q.chapter || "Unknown";

      const topic =
        q.topic ||
        q.concept ||
        chapter ||
        "Unknown";

      const key =
        subject +
        " • " +
        chapter +
        " • " +
        topic;

      if (!map[key]) {
        map[key] = {
          key,
          subject,
          chapter,
          topic,

          total: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,

          retryCount: 0,
          verified: false
        };
      }

      const x = map[key];

      x.total++;

      if (q.status === "correct" ||
          q.isCorrect === true) {
        x.correct++;
      }

      if (q.status === "wrong") {
        x.wrong++;
      }

      if (q.status === "skipped") {
        x.skipped++;
      }
    });

    const recovery =
      Object.values(map)
        .map(function (x) {
          const attempted =
            x.correct + x.wrong;

          x.accuracy =
            attempted
              ? Math.round(
                  x.correct /
                  attempted *
                  100
                )
              : 0;

          x.priority =
            (x.wrong * 3) +
            (x.skipped * 2) +
            (x.accuracy < 75 ? 4 : 0);

          return x;
        })
        .sort(
          (a, b) =>
            b.priority -
            a.priority
        );

    const state = {
      version: "V10",
      topics: recovery,
      weakTopics:
        recovery.filter(
          x => x.accuracy < 75
        ),
      generatedAt: now()
    };

    write(
      K.recovery,
      state
    );

    return state;
  }

  /* =====================================================
     3. VERIFIED MASTERY
     ===================================================== */

  function buildVerifiedMastery() {
    const legacy =
      read(
        K.masteryLegacy,
        {}
      );

    const retryQueue =
      arr(K.retry);

    const evidence =
      getLatestEvidence();

    const map = {};

    function mark(id, data) {
      if (!id) return;

      if (!map[id]) {
        map[id] = {
          id,
          attempts: 0,
          retryAttempts: 0,
          retryCorrect: 0,
          verified: false,
          source: "V10"
        };
      }

      Object.assign(
        map[id],
        data || {}
      );
    }

    evidence.forEach(function (q) {
      mark(
        q.id ||
        ("q-" + q.index),
        {
          lastStatus:
            q.status,

          subject:
            q.subject || "",

          chapter:
            q.chapter || "",

          topic:
            q.topic || ""
        }
      );
    });

    retryQueue.forEach(function (q) {
      const id =
        q.questionId ||
        q.id;

      mark(id, {
        retryAttempts:
          Number(
            q.retryAttempts ||
            q.attempts ||
            0
          ),

        retryCorrect:
          Number(
            q.retryCorrect ||
            q.correctOnRetry ||
            0
          )
      });
    });

    /*
      Explicit verification only.
      Never infer mastery merely because
      a question appeared in mastery storage.
    */

    Object.keys(map).forEach(function (id) {
      const x = map[id];

      const legacyItem =
        Array.isArray(legacy)
          ? legacy.find(
              z =>
                String(
                  z.id ||
                  z.questionId
                ) === String(id)
            )
          : legacy &&
            legacy[id];

      const explicitLegacy =
        legacyItem &&
        (
          legacyItem.retryCorrect === true ||
          legacyItem.correctOnRetry === true ||
          legacyItem.mastered === true ||
          legacyItem.isMastered === true
        );

      x.verified =
        x.retryCorrect > 0 ||
        explicitLegacy === true;
    });

    const all =
      Object.values(map);

    const verified =
      all.filter(
        x => x.verified
      );

    const state = {
      version: "V10",

      all,

      verified,

      verifiedCount:
        verified.length,

      pendingCount:
        all.length -
        verified.length,

      generatedAt: now()
    };

    write(
      K.mastery,
      state
    );

    return state;
  }

  /* =====================================================
     4. ADAPTIVE NEXT TEST
  ===================================================== */

  function buildAdaptiveNextTest(
    trend,
    recovery,
    mastery
  ) {
    const weak =
      recovery.weakTopics || [];

    const pending =
      mastery.pendingCount || 0;

    let mode =
      "mixed";

    let priority =
      "BALANCED";

    let reason =
      "Continue with a balanced coverage-diverse test.";

    if (pending > 0) {
      mode =
        "targeted";

      priority =
        "RETRY";

      reason =
        "Unverified mistakes remain; verify recovery before expanding difficulty.";
    } else if (weak.length) {
      mode =
        "targeted";

      priority =
        "WEAK_TOPIC";

      reason =
        "Weak topics remain below the recovery threshold.";
    } else if (
      trend.latest &&
      trend.latest.accuracy != null &&
      trend.latest.accuracy < 85
    ) {
      mode =
        "mixed";

      priority =
        "ACCURACY";

      reason =
        "Accuracy needs improvement before pushing speed.";
    } else if (
      trend.latest &&
      trend.latest.speed > 0 &&
      trend.deltas.speed < 0
    ) {
      mode =
        "mixed";

      priority =
        "SPEED";

      reason =
        "Recent speed trend dropped; use timed mixed practice.";
    } else {
      mode =
        "adaptive";

      priority =
        "COVERAGE";

      reason =
        "Performance is stable; prioritize unseen coverage and pattern diversity.";
    }

    const top =
      weak.length
        ? weak[0]
        : null;

    const state = {
      version: "V10",

      mode,

      priority,

      reason,

      target:
        top
          ? {
              subject:
                top.subject,

              chapter:
                top.chapter,

              topic:
                top.topic,

              accuracy:
                top.accuracy
            }
          : null,

      constraints: {
        avoidRepeats: true,
        prioritizeUnseenCoverage: true,
        verifyMistakes: pending > 0,
        preserveDifficultyProgression: true
      },

      generatedAt: now()
    };

    write(
      K.adaptive,
      state
    );

    return state;
  }

  /* =====================================================
     MASTER V10 PROCESS
  ===================================================== */

  function process() {
    const trend =
      buildTrend();

    const recovery =
      buildTopicRecovery();

    const mastery =
      buildVerifiedMastery();

    const adaptive =
      buildAdaptiveNextTest(
        trend,
        recovery,
        mastery
      );

    const mentorState =
      Object.assign(
        {},
        read(K.mentor, {}),
        {
          performanceTrend:
            trend,

          weakTopicRecovery:
            recovery,

          verifiedMastery:
            mastery,

          adaptiveNextTest:
            adaptive
        }
      );

    write(
      K.mentor,
      mentorState
    );

    const orbitState =
      Object.assign(
        {},
        read(K.orbit, {}),
        {
          performanceTrend:
            trend,

          weakTopicRecovery:
            recovery,

          verifiedMastery:
            mastery,

          adaptiveNextTest:
            adaptive
        }
      );

    write(
      K.orbit,
      orbitState
    );

    write(
      K.next,
      {
        type:
          adaptive.priority === "RETRY"
            ? "TARGETED_RETRY"
            : adaptive.priority === "WEAK_TOPIC"
            ? "TARGETED_PRACTICE"
            : adaptive.priority === "ACCURACY"
            ? "REVISION"
            : adaptive.priority === "SPEED"
            ? "ATTEMPT_STRATEGY"
            : "NEXT_TEST",

        reason:
          adaptive.reason,

        target:
          adaptive.target || null,

        generatedAt:
          now()
      }
    );

    return {
      trend,
      recovery,
      mastery,
      adaptive
    };
  }

  /* =====================================================
     V8 LIFECYCLE SAFETY PATCH
     ===================================================== */

  function repairLifecycle() {
    try {
      const lifecycle =
        read(K.lifecycle, null);

      if (!lifecycle) return;

      /*
        If V8 incorrectly marked POST
        without an actual submitted result,
        move it back to ACTUAL.
      */

      const result =
        read(
          "cbtCoreResultV6",
          null
        );

      const hasResult =
        result &&
        typeof result === "object" &&
        (
          result.submittedAt ||
          result.completedAt ||
          result.resultId
        );

      if (
        lifecycle.stage === "POST" &&
        !hasResult
      ) {
        write(
          K.lifecycle,
          Object.assign(
            {},
            lifecycle,
            {
              stage: "ACTUAL",
              postProcessedAt: null,
              repairedBy: "V10"
            }
          )
        );
      }
    } catch (_) {}
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.RankerV10AdaptiveEngine = {
    process,
    buildTrend,
    buildTopicRecovery,
    buildVerifiedMastery,
    buildAdaptiveNextTest,
    repairLifecycle,

    getTrend:
      function () {
        return read(K.trend, null);
      },

    getRecovery:
      function () {
        return read(K.recovery, null);
      },

    getMastery:
      function () {
        return read(K.mastery, null);
      },

    getAdaptive:
      function () {
        return read(K.adaptive, null);
      }
  };

  /* =====================================================
     BOOT
  ===================================================== */

  function boot() {
    repairLifecycle();

    /*
      Only analyze existing completed evidence.
      Never convert page-load into POST.
    */

    const post =
      read(K.postV8, null);

    const result =
      read("cbtCoreResultV6", null);

    if (
      post ||
      result
    ) {
      process();
    }
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

})();
