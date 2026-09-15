/* =========================================================
   CBT BEHAVIOR V9
   ADDITIVE ONLY
   Question Timing + Attempt/Skip/Review + Behavior
   + Orbit/Mentor/Next Action
========================================================= */
(function () {
  "use strict";

  const K = {
    live: "cbtBehaviorLiveV9",
    evidence: "cbtBehaviorEvidenceV9",
    analysis: "cbtBehaviorAnalysisV9",
    orbit: "cbtOrbitStateV5",
    mentor: "cbtMentorStateV5",
    next: "cbtNextBestActionV5",
    result: "cbtCoreResultV6",
    history: "cbtHistory",
    sessions: "cbtTestSessions"
  };

  const started = Date.now();

  function read(k, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "null");
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function write(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
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

  function getQuestions() {
    const candidates = [
      window.questions,
      window.testQuestions,
      window.currentQuestions,
      window.CBT_QUESTIONS,
      window.selectedQuestions
    ];

    for (const q of candidates) {
      if (Array.isArray(q) && q.length) return q;
    }

    const result = read(K.result, null);

    if (result && Array.isArray(result.questions))
      return result.questions;

    return [];
  }

  function getAnswers() {
    const candidates = [
      window.answers,
      window.userAnswers,
      window.selectedAnswers,
      window.CBT_ANSWERS
    ];

    for (const a of candidates) {
      if (Array.isArray(a)) return a;
    }

    return [];
  }

  /* =====================================================
     QUESTION STATE
  ===================================================== */

  const state = {
    startedAt: started,
    lastIndex: 0,
    visits: {},
    time: {},
    firstSeen: {},
    lastSeen: {},
    switches: 0,
    answersChanged: {},
    review: {},
    clear: {},
    selected: {},
    savedAt: started
  };

  const existing =
    read(K.live, null);

  if (existing && typeof existing === "object") {
    Object.assign(state, existing);
  }

  function currentIndex() {
    const candidates = [
      window.currentQuestionIndex,
      window.currentIndex,
      window.questionIndex,
      window.currentQuestion
    ];

    for (const x of candidates) {
      if (Number.isInteger(x) && x >= 0)
        return x;
    }

    return Number(state.lastIndex) || 0;
  }

  function touchQuestion(index) {
    if (!Number.isInteger(index) || index < 0)
      return;

    const t = Date.now();

    if (!state.visits[index])
      state.visits[index] = 0;

    state.visits[index]++;

    if (!state.firstSeen[index])
      state.firstSeen[index] = t;

    if (state.lastIndex !== index)
      state.switches++;

    state.lastIndex = index;
    state.lastSeen[index] = t;
    state.savedAt = t;

    saveLive();
  }

  function saveLive() {
    write(K.live, state);
  }

  /* =====================================================
     OPTION / ANSWER EVENTS
  ===================================================== */

  function inspectAnswer(index) {
    const answers = getAnswers();

    if (
      index >= 0 &&
      answers[index] !== undefined &&
      answers[index] !== null &&
      answers[index] !== ""
    ) {
      state.selected[index] =
        answers[index];

      if (!state.answersChanged[index])
        state.answersChanged[index] = 0;
    }
  }

  function captureDom() {
    try {
      const options =
        document.querySelectorAll(
          ".option.selected, input[type=radio]:checked"
        );

      options.forEach(function (el) {
        const raw =
          el.dataset &&
          (el.dataset.index || el.dataset.value);

        if (raw != null) {
          const i = currentIndex();
          state.selected[i] = raw;
        }
      });
    } catch (_) {}
  }

  /* =====================================================
     REVIEW / CLEAR DETECTION
  ===================================================== */

  function scanButtons() {
    const text =
      String(document.body.innerText || "")
        .toLowerCase();

    return {
      reviewVisible:
        text.includes("mark for review") ||
        text.includes("review"),

      clearVisible:
        text.includes("clear response")
    };
  }

  document.addEventListener(
    "click",
    function (e) {
      const el =
        e.target &&
        e.target.closest
          ? e.target.closest("button,[role=button],.option")
          : null;

      if (!el) return;

      const text =
        String(el.innerText || el.textContent || "")
          .trim()
          .toLowerCase();

      const i = currentIndex();

      if (
        text.includes("review") ||
        text.includes("mark")
      ) {
        state.review[i] =
          (state.review[i] || 0) + 1;
      }

      if (
        text.includes("clear") &&
        text.includes("response")
      ) {
        state.clear[i] =
          (state.clear[i] || 0) + 1;
      }

      if (
        text === "next" ||
        text.includes("next question") ||
        text === "previous" ||
        text.includes("prev")
      ) {
        captureDom();
        inspectAnswer(i);
      }

      saveLive();
    },
    true
  );

  document.addEventListener(
    "change",
    function () {
      const i = currentIndex();

      state.answersChanged[i] =
        (state.answersChanged[i] || 0) + 1;

      inspectAnswer(i);
      saveLive();
    },
    true
  );

  document.addEventListener(
    "input",
    function () {
      inspectAnswer(currentIndex());
      saveLive();
    },
    true
  );

  /* =====================================================
     TIME CALCULATION
  ===================================================== */

  function buildEvidence() {
    const questions = getQuestions();
    const answers = getAnswers();
    const out = [];

    const now = Date.now();

    questions.forEach(function (q, i) {
      const selected =
        answers[i] !== undefined
          ? answers[i]
          : state.selected[i];

      const correct =
        q &&
        (
          q.correctAnswer ??
          q.answer ??
          q.correctIndex
        );

      let status = "skipped";

      if (
        selected !== undefined &&
        selected !== null &&
        selected !== ""
      ) {
        status =
          norm(selected) === norm(correct) ||
          q.isCorrect === true
            ? "correct"
            : "wrong";
      }

      const first =
        Number(state.firstSeen[i] || started);

      const last =
        Number(state.lastSeen[i] || now);

      const rawTime =
        Math.max(0, last - first);

      const visits =
        Number(state.visits[i] || 0);

      const estimatedTime =
        visits > 0
          ? Math.round(
              rawTime / 1000
            )
          : 0;

      out.push({
        id:
          q.id ||
          q.questionId ||
          ("q-" + i),

        index: i,

        question:
          q.question ||
          q.text ||
          "",

        subject:
          q.subject || "",

        chapter:
          q.chapter || "",

        topic:
          q.topic || "",

        concept:
          q.concept || "",

        selectedAnswer:
          selected == null ? null : selected,

        correctAnswer:
          correct == null ? null : correct,

        status,

        isCorrect:
          status === "correct",

        visits,

        timeSpent:
          estimatedTime,

        reviewCount:
          Number(state.review[i] || 0),

        clearCount:
          Number(state.clear[i] || 0),

        answerChanges:
          Number(state.answersChanged[i] || 0),

        decisionPattern:
          visits > 1
            ? "Revisit"
            : status === "skipped"
            ? "Skipped"
            : "Single-pass",

        capturedAt: now
      });
    });

    return out;
  }

  /* =====================================================
     BEHAVIOR ANALYSIS
  ===================================================== */

  function analyse(evidence) {
    const total = evidence.length;

    const answered =
      evidence.filter(
        q => q.status === "correct" ||
             q.status === "wrong"
      );

    const correct =
      evidence.filter(
        q => q.status === "correct"
      ).length;

    const wrong =
      evidence.filter(
        q => q.status === "wrong"
      ).length;

    const skipped =
      evidence.filter(
        q => q.status === "skipped"
      ).length;

    const attempted =
      correct + wrong;

    const accuracy =
      attempted
        ? Math.round(
            correct / attempted * 100
          )
        : 0;

    const times =
      evidence
        .map(q => q.timeSpent)
        .filter(x => Number.isFinite(x) && x > 0);

    const totalTime =
      times.reduce(
        (a, b) => a + b,
        0
      );

    const avgTime =
      times.length
        ? Math.round(
            totalTime / times.length
          )
        : 0;

    const slowQuestions =
      evidence
        .filter(q =>
          q.timeSpent >= 120
        )
        .sort(
          (a, b) =>
            b.timeSpent - a.timeSpent
        );

    const repeatedVisits =
      evidence.filter(
        q => q.visits > 1
      ).length;

    const reviewed =
      evidence.filter(
        q => q.reviewCount > 0
      ).length;

    const cleared =
      evidence.filter(
        q => q.clearCount > 0
      ).length;

    const changed =
      evidence.filter(
        q => q.answerChanges > 1
      ).length;

    let bottleneck =
      "Stable";

    if (slowQuestions.length >= 3)
      bottleneck = "Time Pressure";

    if (skipped >= Math.max(3, Math.ceil(total * .1)))
      bottleneck = "Attempt Selection";

    if (changed >= 3 && wrong > correct * .35)
      bottleneck = "Answer Instability";

    if (accuracy < 70)
      bottleneck = "Concept / Pattern Gap";

    if (
      accuracy >= 80 &&
      slowQuestions.length >= 3
    )
      bottleneck = "Speed";

    return {
      total,
      answered: answered.length,
      correct,
      wrong,
      skipped,
      accuracy,

      totalTime,
      avgTime,

      slowQuestions:
        slowQuestions.slice(0, 10),

      repeatedVisits,
      reviewed,
      cleared,
      changed,

      switches:
        Number(state.switches || 0),

      bottleneck,

      generatedAt:
        Date.now()
    };
  }

  /* =====================================================
     MENTOR DECISION
  ===================================================== */

  function decide(a) {
    if (a.wrong > 0 && a.accuracy < 75) {
      return {
        type: "TARGETED_RETRY",
        priority: "HIGH",
        message:
          "Wrong questions need verified retry before moving ahead."
      };
    }

    if (a.bottleneck === "Time Pressure") {
      return {
        type: "ATTEMPT_STRATEGY",
        priority: "HIGH",
        message:
          "Time loss is significant. Review skip, revisit and time-allocation strategy."
      };
    }

    if (a.bottleneck === "Attempt Selection") {
      return {
        type: "ATTEMPT_STRATEGY",
        priority: "HIGH",
        message:
          "Too many questions were left or delayed. Improve question-selection strategy."
      };
    }

    if (a.bottleneck === "Answer Instability") {
      return {
        type: "QUESTION_READING",
        priority: "MEDIUM",
        message:
          "Frequent answer changes indicate uncertainty. Review question interpretation before changing answers."
      };
    }

    if (a.bottleneck === "Speed") {
      return {
        type: "SPEED_PRACTICE",
        priority: "MEDIUM",
        message:
          "Accuracy is comparatively stable but time per question is high. Build timed practice."
      };
    }

    if (a.accuracy < 85) {
      return {
        type: "REVISION",
        priority: "MEDIUM",
        message:
          "Revise weak concepts before the next full test."
      };
    }

    return {
      type: "NEXT_TEST",
      priority: "NORMAL",
      message:
        "Performance is stable. Continue with the next coverage-diverse test."
    };
  }

  /* =====================================================
     PERSIST
  ===================================================== */

  function process() {
    const evidence =
      buildEvidence();

    const analysis =
      analyse(evidence);

    const action =
      decide(analysis);

    write(K.evidence, {
      version: "V9",
      savedAt: Date.now(),
      questions: evidence
    });

    const finalState = {
      version: "V9",
      savedAt: Date.now(),
      analysis,
      mentorAction: action
    };

    write(K.analysis, finalState);

    write(K.orbit, Object.assign(
      {},
      read(K.orbit, {}),
      {
        behaviorV9: finalState
      }
    ));

    write(K.mentor, Object.assign(
      {},
      read(K.mentor, {}),
      {
        behaviorV9: finalState,
        latestBehaviorAction: action
      }
    ));

    write(K.next, action);

    saveLive();

    return finalState;
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.CBTBehaviorV9 = {
    state,
    touchQuestion,
    buildEvidence,
    analyse,
    decide,
    process,
    getAnalysis:
      function () {
        return read(K.analysis, null);
      }
  };

  /* =====================================================
     MONITOR
  ===================================================== */

  function monitor() {
    try {
      touchQuestion(currentIndex());
      inspectAnswer(currentIndex());
      captureDom();
    } catch (_) {}
  }

  setInterval(
    monitor,
    1000
  );

  window.addEventListener(
    "visibilitychange",
    function () {
      process();
    }
  );

  window.addEventListener(
    "beforeunload",
    function () {
      process();
    }
  );

  /* =====================================================
     SUBMIT BRIDGE
  ===================================================== */

  function hookSubmit() {
    if (
      typeof window.submitTest !== "function" ||
      window.submitTest.__behaviorV9Wrapped
    ) return;

    const original =
      window.submitTest;

    function wrapped() {
      try {
        process();
      } catch (_) {}

      const result =
        original.apply(this, arguments);

      setTimeout(
        function () {
          try {
            process();
          } catch (_) {}
        },
        500
      );

      return result;
    }

    wrapped.__behaviorV9Wrapped = true;
    wrapped.__originalSubmitTest = original;

    window.submitTest = wrapped;
  }

  function boot() {
    touchQuestion(currentIndex());
    hookSubmit();

    setTimeout(hookSubmit, 1000);
    setTimeout(hookSubmit, 3000);
    setTimeout(process, 3500);
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
