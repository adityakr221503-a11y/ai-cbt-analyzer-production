/* =========================================================
   RANKER V11 — REAL TEST LIFECYCLE BRIDGE
   PRE -> ACTUAL -> POST -> ADAPTIVE NEXT ACTION
   ADDITIVE ONLY
========================================================= */
(function () {
  "use strict";

  const K = {
    lifecycle: "cbtRankerLifecycleV8",
    pending: "cbtRankerPendingActualV11",
    adaptive: "cbtAdaptiveNextTestV10",
    post: "cbtPostTestStateV8",
    result: "cbtCoreResultV6",
    resultV5: "cbtCoreResultV5",
    history: "cbtHistory",
    sessions: "cbtTestSessions",
    retry: "cbtAnalyzer.retryQueue",
    next: "cbtNextBestActionV5",
    mentor: "cbtMentorStateV5",
    orbit: "cbtOrbitStateV5",
    evidence: "cbtQuestionEvidenceV9"
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
      localStorage.setItem(k, JSON.stringify(v));
    } catch (_) {}
  }

  function arr(k) {
    const v = read(k, []);
    return Array.isArray(v) ? v : [];
  }

  function now() {
    return Date.now();
  }

  function latest(a) {
    return a.length ? a[a.length - 1] : null;
  }

  function normalize(v) {
    return String(v == null ? "" : v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /* =====================================================
     LIFECYCLE
  ===================================================== */

  function lifecycle() {
    return read(K.lifecycle, {
      stage: "PRE",
      testId: null,
      title: "",
      startedAt: null,
      actualStartedAt: null,
      submittedAt: null,
      postProcessedAt: null
    });
  }

  function setLifecycle(stage, extra) {
    const current = lifecycle();

    const next = Object.assign(
      {},
      current,
      extra || {},
      {
        stage,
        updatedAt: now()
      }
    );

    write(K.lifecycle, next);
    return next;
  }

  function markPendingActual(meta) {
    write(K.pending, {
      version: "V11",
      createdAt: now(),
      testId:
        meta && meta.testId
          ? meta.testId
          : null,
      title:
        meta && meta.title
          ? meta.title
          : "Ranker Test"
    });
  }

  function consumePending() {
    const p = read(K.pending, null);

    if (!p) return null;

    const age =
      now() -
      Number(p.createdAt || 0);

    if (age > 10 * 60 * 1000) {
      try {
        localStorage.removeItem(K.pending);
      } catch (_) {}
      return null;
    }

    return p;
  }

  function clearPending() {
    try {
      localStorage.removeItem(K.pending);
    } catch (_) {}
  }

  /* =====================================================
     ADAPTIVE PLAN
  ===================================================== */

  function getAdaptivePlan() {
    const plan =
      read(K.adaptive, null);

    if (!plan || typeof plan !== "object")
      return null;

    return plan;
  }

  function targetText(plan) {
    if (!plan || !plan.target)
      return "";

    const t = plan.target;

    return [
      t.subject,
      t.chapter,
      t.topic
    ]
      .filter(Boolean)
      .join(" • ");
  }

  function applyAdaptivePlan() {
    const plan =
      getAdaptivePlan();

    if (!plan) return;

    const mode =
      document.getElementById("mode");

    const status =
      document.getElementById("status");

    if (mode) {
      const wanted =
        String(plan.mode || "");

      const option =
        Array.from(mode.options)
          .find(
            o =>
              o.value === wanted
          );

      if (option) {
        mode.value = wanted;
      }
    }

    if (!document.getElementById(
      "rankerV11AdaptiveCard"
    )) {
      const card =
        document.createElement("section");

      card.id =
        "rankerV11AdaptiveCard";

      card.className = "card";

      const target =
        targetText(plan);

      card.innerHTML =
        "<h2>🎯 Adaptive Test Plan</h2>" +
        "<p class='muted'>" +
        "Priority: <b>" +
        String(plan.priority || "BALANCED") +
        "</b></p>" +
        "<p class='muted'>" +
        String(plan.reason || "") +
        "</p>" +
        (
          target
            ? "<p class='muted'>Target: <b>" +
              target +
              "</b></p>"
            : ""
        );

      const builder =
        document.querySelector(
          "#start"
        );

      if (
        builder &&
        builder.closest(".card")
      ) {
        builder.closest(".card")
          .parentNode
          .insertBefore(
            card,
            builder.closest(".card")
          );
      } else {
        document.body.prepend(card);
      }
    }

    if (status && plan.reason) {
      status.textContent =
        "Adaptive plan: " +
        plan.reason;
    }
  }

  /* =====================================================
     PRE → ACTUAL
  ===================================================== */

  function detectSelectedPool() {
    try {
      const raw =
        localStorage.getItem(
          "rbSelectedQuestions"
        );

      if (!raw) return [];

      const x =
        JSON.parse(raw);

      return Array.isArray(x)
        ? x
        : Array.isArray(x.questions)
        ? x.questions
        : [];
    } catch (_) {
      return [];
    }
  }

  function bootCBTActual() {
    const path =
      String(
        location.pathname || ""
      ).toLowerCase();

    if (!path.endsWith("cbt.html"))
      return;

    const pending =
      consumePending();

    const selected =
      detectSelectedPool();

    const source =
      localStorage.getItem(
        "CBT_ACTIVE_SOURCE"
      ) ||
      sessionStorage.getItem(
        "CBT_ACTIVE_SOURCE"
      ) ||
      "";

    const isRanker =
      normalize(source).includes("ranker") ||
      normalize(source).includes("rank booster") ||
      normalize(source).includes("rankers");

    if (
      pending ||
      (isRanker && selected.length)
    ) {
      const current =
        lifecycle();

      if (
        current.stage !== "ACTUAL" &&
        current.stage !== "POST"
      ) {
        setLifecycle(
          "ACTUAL",
          {
            testId:
              pending &&
              pending.testId
                ? pending.testId
                : null,

            title:
              pending &&
              pending.title
                ? pending.title
                : "Ranker Test",

            startedAt:
              current.startedAt ||
              now(),

            actualStartedAt:
              now(),

            source:
              "Ranker Test Series",

            questionCount:
              selected.length
          }
        );
      }

      clearPending();
    }
  }

  /* =====================================================
     RESULT DETECTION
  ===================================================== */

  function validResult(x) {
    if (!x || typeof x !== "object")
      return false;

    const hasCounts =
      [
        x.correct,
        x.wrong,
        x.skipped,
        x.score
      ].some(
        v =>
          v !== undefined &&
          v !== null
      );

    const hasTime =
      x.submittedAt ||
      x.completedAt ||
      x.resultId ||
      x.id;

    return Boolean(
      hasCounts &&
      hasTime
    );
  }

  function getCompletedResult() {
    const candidates = [
      read(K.result, null),
      read(K.resultV5, null),
      latest(arr(K.history)),
      latest(arr(K.sessions))
    ];

    for (const x of candidates) {
      if (validResult(x))
        return x;
    }

    return null;
  }

  /* =====================================================
     POST ACTION
  ===================================================== */

  function deriveNextAction(result) {
    const retry =
      arr(K.retry);

    if (retry.length) {
      return {
        type: "TARGETED_RETRY",
        reason:
          "Pending mistakes require verified retry.",
        route:
          "./retry.html?source=ranker-v11"
      };
    }

    const post =
      read(K.post, null);

    if (
      post &&
      Array.isArray(post.weakTopics) &&
      post.weakTopics.length
    ) {
      const t =
        post.weakTopics[0];

      return {
        type: "TARGETED_PRACTICE",
        reason:
          "Weak topic requires targeted practice.",
        target: t,
        route:
          "./rankers-test-series.html?mode=targeted&topic=" +
          encodeURIComponent(
            t.topic || ""
          )
      };
    }

    const skipped =
      Number(
        result &&
        result.skipped
      ) || 0;

    if (skipped > 0) {
      return {
        type: "ATTEMPT_STRATEGY",
        reason:
          "Skipped questions require attempt-strategy review.",
        route:
          "./attempt.html"
      };
    }

    const accuracy =
      Number(
        result &&
        result.accuracy
      );

    if (
      Number.isFinite(accuracy) &&
      accuracy < 85
    ) {
      return {
        type: "REVISION",
        reason:
          "Accuracy requires revision before the next test.",
        route:
          "./question-bank.html?mode=weak"
      };
    }

    return {
      type: "NEXT_TEST",
      reason:
        "Performance is ready for the next adaptive test.",
      route:
        "./rankers-test-series.html?mode=adaptive"
    };
  }

  function completePost() {
    const current =
      lifecycle();

    if (
      current.stage !== "ACTUAL" &&
      current.stage !== "POST"
    ) {
      return null;
    }

    const result =
      getCompletedResult();

    if (!result)
      return null;

    if (
      current.resultId &&
      String(current.resultId) ===
      String(
        result.id ||
        result.sessionId ||
        result.resultId
      )
    ) {
      return current;
    }

    const action =
      deriveNextAction(result);

    const next =
      setLifecycle(
        "POST",
        {
          submittedAt:
            result.submittedAt ||
            result.completedAt ||
            now(),

          postProcessedAt:
            now(),

          resultId:
            result.id ||
            result.sessionId ||
            result.resultId ||
            null,

          source:
            current.source ||
            "Ranker Test Series",

          nextAction:
            action
        }
      );

    write(
      K.next,
      action
    );

    write(
      K.mentor,
      Object.assign(
        {},
        read(K.mentor, {}),
        {
          v11LifecycleAction:
            action,
          v11UpdatedAt:
            now()
        }
      )
    );

    write(
      K.orbit,
      Object.assign(
        {},
        read(K.orbit, {}),
        {
          v11Lifecycle:
            next,
          v11NextAction:
            action
        }
      )
    );

    write(
      "cbtRankerPostActionV11",
      {
        lifecycle: next,
        result,
        action,
        generatedAt: now()
      }
    );

    return next;
  }

  /* =====================================================
     SUBMIT HOOK
  ===================================================== */

  function hookSubmit() {
    if (
      typeof window.submitTest !==
      "function"
    ) {
      return false;
    }

    if (
      window.submitTest
        .__rankerV11Wrapped
    ) {
      return true;
    }

    const original =
      window.submitTest;

    function wrappedSubmit() {
      const out =
        original.apply(
          this,
          arguments
        );

      /*
        Never mark POST merely because
        submitTest was called.
        Wait until an actual result
        exists in storage.
      */

      let tries = 0;

      const poll =
        setInterval(
          function () {
            tries++;

            const done =
              completePost();

            if (
              done ||
              tries >= 20
            ) {
              clearInterval(poll);
            }
          },
          500
        );

      return out;
    }

    wrappedSubmit
      .__rankerV11Wrapped = true;

    wrappedSubmit
      .__originalSubmitTest =
      original;

    window.submitTest =
      wrappedSubmit;

    return true;
  }

  /* =====================================================
     ACTION CARD AFTER POST
  ===================================================== */

  function renderPostAction() {
    const post =
      read(
        "cbtRankerPostActionV11",
        null
      );

    if (!post || !post.action)
      return;

    if (
      document.getElementById(
        "rankerV11PostAction"
      )
    ) {
      return;
    }

    const box =
      document.createElement(
        "section"
      );

    box.id =
      "rankerV11PostAction";

    box.style.cssText =
      "margin:16px 0;padding:18px;" +
      "border:1px solid #dfe4ec;" +
      "border-radius:16px;background:#fff;";

    const a =
      post.action;

    const button =
      a.route
        ? "<button type='button' id='rankerV11NextBtn'>" +
          "Continue →" +
          "</button>"
        : "";

    box.innerHTML =
      "<h2>🧠 Next Best Action</h2>" +
      "<p><b>" +
      String(a.type || "NEXT_TEST") +
      "</b></p>" +
      "<p class='muted'>" +
      String(a.reason || "") +
      "</p>" +
      button;

    const anchor =
      document.querySelector(
        "#questionReview"
      ) ||
      document.querySelector(
        ".question-review"
      ) ||
      document.body.firstElementChild;

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(
        box,
        anchor
      );
    } else {
      document.body.appendChild(box);
    }

    const btn =
      document.getElementById(
        "rankerV11NextBtn"
      );

    if (btn) {
      btn.onclick =
        function () {
          location.href =
            a.route;
        };
    }
  }

  /* =====================================================
     BOOT
  ===================================================== */

  function boot() {
    const path =
      String(
        location.pathname || ""
      ).toLowerCase();

    if (
      path.includes(
        "rankers-test-series"
      )
    ) {
      applyAdaptivePlan();

      /*
        Mark PRE intent only.
        ACTUAL happens after CBT really opens.
      */

      const start =
        document.getElementById(
          "start"
        );

      if (start) {
        start.addEventListener(
          "click",
          function () {
            setTimeout(
              function () {
                const selected =
                  detectSelectedPool();

                if (
                  selected.length
                ) {
                  markPendingActual({
                    testId:
                      "ranker-" +
                      now(),

                    title:
                      "Ranker Adaptive Test"
                  });
                }
              },
              150
            );
          },
          false
        );
      }
    }

    if (
      path.endsWith(
        "cbt.html"
      )
    ) {
      bootCBTActual();

      hookSubmit();

      setTimeout(
        hookSubmit,
        500
      );

      setTimeout(
        hookSubmit,
        1500
      );

      setTimeout(
        renderPostAction,
        2500
      );

      setTimeout(
        renderPostAction,
        5000
      );
    }
  }

  window.RankerV11Lifecycle = {
    lifecycle,
    setLifecycle,
    markPendingActual,
    bootCBTActual,
    getCompletedResult,
    completePost,
    getAdaptivePlan,
    applyAdaptivePlan,
    deriveNextAction
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

})();
