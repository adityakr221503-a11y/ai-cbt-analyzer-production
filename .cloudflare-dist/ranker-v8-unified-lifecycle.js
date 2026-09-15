/* =========================================================
   RANKER V8 — UNIFIED TEST LIFECYCLE + EVIDENCE BRIDGE
   ADDITIVE ONLY
   PRE -> ACTUAL -> POST -> ORBIT -> MENTOR -> ACTION
========================================================= */
(function () {
  "use strict";

  const K = {
    lifecycle: "cbtRankerLifecycleV8",
    evidence: "cbtQuestionEvidenceV8",
    post: "cbtPostTestStateV8",
    history: "cbtHistory",
    sessions: "cbtTestSessions",
    retry: "cbtAnalyzer.retryQueue",
    mastery: "cbtMasteryV2",
    mentor: "cbtMentorStateV5",
    orbit: "cbtOrbitStateV5",
    next: "cbtNextBestActionV5"
  };

  function read(key, fallback) {
    try {
      const x = JSON.parse(localStorage.getItem(key) || "null");
      return x == null ? fallback : x;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function arr(key) {
    const x = read(key, []);
    return Array.isArray(x) ? x : [];
  }

  function now() {
    return Date.now();
  }

  function id(prefix) {
    return prefix + "-" + now() + "-" +
      Math.random().toString(36).slice(2, 8);
  }

  function normalize(v) {
    return String(v == null ? "" : v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function getLatestHistory() {
    const h = arr(K.history);
    return h.length ? h[h.length - 1] : null;
  }

  function getLatestSession() {
    const s = arr(K.sessions);
    return s.length ? s[s.length - 1] : null;
  }

  function getLatestResult() {
    const direct = read("cbtCoreResultV6", null);
    if (direct && typeof direct === "object") return direct;

    const post = read("cbtCoreResultV4", null);
    if (post && typeof post === "object") return post;

    const h = getLatestHistory();
    if (h) return h;

    return getLatestSession();
  }

  /* =====================================================
     1. TEST LIFECYCLE
  ===================================================== */

  function getLifecycle() {
    return read(K.lifecycle, {
      stage: "PRE",
      testId: null,
      startedAt: null,
      actualStartedAt: null,
      submittedAt: null,
      postProcessedAt: null
    });
  }

  function setLifecycle(stage, extra) {
    const old = getLifecycle();

    const next = Object.assign({}, old, extra || {}, {
      stage: stage,
      updatedAt: now()
    });

    if (stage === "ACTUAL" && !next.actualStartedAt) {
      next.actualStartedAt = now();
    }

    if (stage === "POST" && !next.postProcessedAt) {
      next.postProcessedAt = now();
    }

    write(K.lifecycle, next);
    return next;
  }

  function startActual(testId, title) {
    return setLifecycle("ACTUAL", {
      testId: testId || null,
      title: title || "",
      actualStartedAt: now()
    });
  }

  function finishPost() {
    const result = getLatestResult();

    const state = setLifecycle("POST", {
      submittedAt: now(),
      resultId: result && (result.id || result.sessionId) || null
    });

    processPostEvidence(result);
    return state;
  }

  /* =====================================================
     2. QUESTION LEVEL EVIDENCE
  ===================================================== */

  function extractQuestions(result) {
    if (!result || typeof result !== "object") return [];

    const candidates = [
      result.questions,
      result.questionEvidence,
      result.evidence,
      result.items
    ];

    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }

    return [];
  }

  function buildQuestionEvidence(result) {
    const questions = extractQuestions(result);

    return questions.map(function (q, index) {
      if (!q || typeof q !== "object") return null;

      const selected =
        q.selectedAnswer ??
        q.selected ??
        q.userAnswer ??
        q.answerGiven ??
        q.selectedIndex ??
        null;

      const correct =
        q.correctAnswer ??
        q.correct ??
        q.answer ??
        q.correctIndex ??
        null;

      let status = q.status || "";

      if (!status) {
        if (
          selected === null ||
          selected === undefined ||
          selected === ""
        ) {
          status = "skipped";
        } else if (
          normalize(selected) === normalize(correct) ||
          q.isCorrect === true ||
          q.correct === true
        ) {
          status = "correct";
        } else {
          status = "wrong";
        }
      }

      return {
        id: q.id || q.questionId || ("q-" + index),
        index: index,

        question: q.question || q.text || "",
        subject: q.subject || "",
        chapter: q.chapter || "",
        topic: q.topic || "",
        concept: q.concept || "",

        selectedAnswer: selected,
        correctAnswer: correct,

        status: status,

        isCorrect:
          status === "correct" ||
          q.isCorrect === true,

        mistakeType:
          q.mistakeType ||
          q.mistakeReason ||
          "",

        solution:
          q.solution ||
          q.explanation ||
          "",

        markedForReview:
          q.markedForReview === true ||
          q.review === true,

        timeSpent:
          Number(
            q.timeSpent ??
            q.time ??
            q.timeTaken ??
            0
          ) || 0,

        source:
          q.source ||
          "CBT",

        capturedAt: now()
      };
    }).filter(Boolean);
  }

  function saveEvidence(result) {
    const evidence = buildQuestionEvidence(result);

    write(K.evidence, {
      version: "V8",
      savedAt: now(),
      count: evidence.length,
      questions: evidence
    });

    return evidence;
  }

  /* =====================================================
     3. POST TEST ANALYSIS
  ===================================================== */

  function analyse(evidence) {
    const total = evidence.length;

    const correct =
      evidence.filter(q => q.status === "correct").length;

    const wrong =
      evidence.filter(q => q.status === "wrong").length;

    const skipped =
      evidence.filter(q => q.status === "skipped").length;

    const attempted = correct + wrong;

    const accuracy =
      attempted ?
      Math.round((correct / attempted) * 100) :
      0;

    const topicMap = {};
    const mistakeMap = {};

    evidence.forEach(function (q) {
      const topic =
        q.topic ||
        q.chapter ||
        "Unclassified";

      if (!topicMap[topic]) {
        topicMap[topic] = {
          topic: topic,
          total: 0,
          correct: 0,
          wrong: 0,
          skipped: 0
        };
      }

      topicMap[topic].total++;

      if (q.status === "correct")
        topicMap[topic].correct++;

      if (q.status === "wrong")
        topicMap[topic].wrong++;

      if (q.status === "skipped")
        topicMap[topic].skipped++;

      if (q.status === "wrong") {
        const m =
          q.mistakeType ||
          "Concept / Pattern Gap";

        mistakeMap[m] =
          (mistakeMap[m] || 0) + 1;
      }
    });

    const weakTopics =
      Object.values(topicMap)
        .map(function (x) {
          const attempted = x.correct + x.wrong;

          return Object.assign({}, x, {
            accuracy:
              attempted ?
              Math.round((x.correct / attempted) * 100) :
              0
          });
        })
        .filter(x =>
          x.total >= 1 &&
          x.accuracy < 75
        )
        .sort((a, b) =>
          a.accuracy - b.accuracy
        );

    return {
      total,
      correct,
      wrong,
      skipped,
      attempted,
      accuracy,
      topics: Object.values(topicMap),
      weakTopics,
      mistakes: mistakeMap
    };
  }

  /* =====================================================
     4. ORBIT + MENTOR + NEXT ACTION BRIDGE
  ===================================================== */

  function processPostEvidence(result) {
    const evidence = saveEvidence(result);
    const analysis = analyse(evidence);

    const nextAction =
      analysis.wrong > 0
        ? {
            type: "TARGETED_RETRY",
            reason: "Wrong questions need verified retry/mastery."
          }
        : analysis.weakTopics.length
        ? {
            type: "TARGETED_PRACTICE",
            reason: "Weak topics detected below 75% accuracy."
          }
        : analysis.skipped > 0
        ? {
            type: "ATTEMPT_STRATEGY",
            reason: "Skipped questions need attempt-strategy review."
          }
        : analysis.accuracy < 85
        ? {
            type: "REVISION",
            reason: "Overall accuracy needs revision."
          }
        : {
            type: "NEXT_TEST",
            reason: "Current test performance is stable."
          };

    const post = {
      version: "V8",
      generatedAt: now(),

      lifecycle: getLifecycle(),

      summary: {
        total: analysis.total,
        attempted: analysis.attempted,
        correct: analysis.correct,
        wrong: analysis.wrong,
        skipped: analysis.skipped,
        accuracy: analysis.accuracy
      },

      weakTopics: analysis.weakTopics,
      mistakes: analysis.mistakes,

      nextAction
    };

    write(K.post, post);

    write(K.orbit, Object.assign(
      {},
      read(K.orbit, {}),
      {
        source: "CBT_CORE_V8",
        lastPostTest: post
      }
    ));

    write(K.mentor, Object.assign(
      {},
      read(K.mentor, {}),
      {
        source: "CBT_CORE_V8",
        lastDiagnosis: nextAction,
        weakTopics: analysis.weakTopics,
        mistakes: analysis.mistakes,
        accuracy: analysis.accuracy
      }
    ));

    write(K.next, nextAction);

    return post;
  }

  /* =====================================================
     TARGETED HANDOFF
  ===================================================== */

  function getTopWeakTopic() {
    const post = read(K.post, null);

    if (
      post &&
      Array.isArray(post.weakTopics) &&
      post.weakTopics.length
    ) {
      return post.weakTopics[0];
    }

    return null;
  }

  function startTargetedPractice() {
    const topic = getTopWeakTopic();

    if (!topic) {
      window.location.href =
        "./rankers-test-series.html";
      return;
    }

    const url =
      "./rankers-test-series.html" +
      "?mode=targeted" +
      "&topic=" +
      encodeURIComponent(topic.topic || "");

    window.location.href = url;
  }

  function startRetry() {
    const queue = arr(K.retry);

    if (!queue.length) {
      startTargetedPractice();
      return;
    }

    const first = queue[0];

    write(
      "cbtRetryQuestion",
      first
    );

    window.location.href =
      "./retry.html?source=ranker-v8";
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.RankerV8Lifecycle = {
    getLifecycle,
    setLifecycle,
    startActual,
    finishPost,
    getLatestResult,
    buildQuestionEvidence,
    saveEvidence,
    analyse,
    processPostEvidence,
    getTopWeakTopic,
    startTargetedPractice,
    startRetry
  };

  /* =====================================================
     AUTO DETECTION
  ===================================================== */

  function boot() {
    const path =
      String(location.pathname || "").toLowerCase();

    if (path.includes("rankers-test-series")) {
      const testId =
        new URLSearchParams(location.search)
          .get("test");

      if (testId) {
        startActual(testId, "Rankers Test");
      }
    }

    if (path.endsWith("/cbt.html") ||
        path.endsWith("cbt.html")) {

      window.addEventListener(
        "beforeunload",
        function () {
          try {
            const result =
              getLatestResult();

            if (result) {
              saveEvidence(result);
            }
          } catch (_) {}
        }
      );

      const oldSubmit =
        window.submitTest;

      if (
        typeof oldSubmit === "function" &&
        !oldSubmit.__rankerV8Wrapped
      ) {
        function wrappedSubmit() {
          const out =
            oldSubmit.apply(this, arguments);

          setTimeout(function () {
            try {
              finishPost();
            } catch (_) {}
          }, 350);

          return out;
        }

        wrappedSubmit.__rankerV8Wrapped = true;
        wrappedSubmit.__originalSubmitTest =
          oldSubmit;

        window.submitTest = wrappedSubmit;
      }

      setTimeout(function () {
        try {
          finishPost();
        } catch (_) {}
      }, 2500);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

})();
