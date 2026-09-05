/* =========================================================
   RANKER V11.3 — FINAL RUNTIME STABILITY LAYER
   ADDITIVE ONLY
   Fixes:
   1. Reliable CBT timer based speed
   2. Reliable post-test Next Best Action
   3. Re-render protection
   Existing CBT/Orbit/Mistake/Retry structure preserved.
========================================================= */
(function () {
  "use strict";

  const POST_KEY = "cbtRankerPostActionV11";
  const NEXT_KEY = "cbtNextBestActionV5";
  const RETRY_KEY = "cbtAnalyzer.retryQueue";
  const POST_STATE = "cbtPostTestStateV8";
  const START_KEY = "CBT_ACTIVE_STARTED_AT";

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
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (_) {}
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function arr(key) {
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  }

  function getLatestSession() {
    const value =
      read("cbtTestSessions", []);

    if (
      !Array.isArray(value) ||
      !value.length
    ) {
      return null;
    }

    return value[value.length - 1];
  }

  function getLatestHistory() {
    const value =
      read("cbtHistory", []);

    if (
      !Array.isArray(value) ||
      !value.length
    ) {
      return null;
    }

    return value[value.length - 1];
  }

  function getResult() {
    try {
      if (
        window.RankerV11Lifecycle &&
        typeof window.RankerV11Lifecycle.getCompletedResult ===
          "function"
      ) {
        const r =
          window.RankerV11Lifecycle.getCompletedResult();

        if (
          r &&
          typeof r === "object"
        ) {
          return r;
        }
      }
    } catch (_) {}

    const keys = [
      "cbtCoreResultV6",
      "cbtCoreResultV5"
    ];

    for (const key of keys) {
      const r = read(key, null);

      if (
        r &&
        typeof r === "object"
      ) {
        return r.result &&
          typeof r.result === "object"
          ? r.result
          : r;
      }
    }

    return (
      getLatestHistory() ||
      getLatestSession()
    );
  }

  function startTimestamp() {
    let session = 0;
    let local = 0;

    try {
      session =
        Number(
          sessionStorage.getItem(
            START_KEY
          ) || 0
        );
    } catch (_) {}

    try {
      local =
        Number(
          localStorage.getItem(
            START_KEY
          ) || 0
        );
    } catch (_) {}

    return session || local || 0;
  }

  /*
    Read the actual visible CBT countdown.

    Expected existing CBT display:
    .timer

    Examples:
    29:55
    01:42:10
  */
  function visibleTimerSeconds() {
    const el =
      document.querySelector(
        ".timer"
      );

    if (!el) return 0;

    const text =
      String(
        el.textContent || ""
      ).trim();

    const match =
      text.match(
        /(\d{1,3}):(\d{2})(?::(\d{2}))?/
      );

    if (!match) return 0;

    if (match[3] != null) {
      return (
        Number(match[1]) * 3600 +
        Number(match[2]) * 60 +
        Number(match[3])
      );
    }

    return (
      Number(match[1]) * 60 +
      Number(match[2])
    );
  }

  function testDurationSeconds() {
    try {
      const candidates = [
        window.selectedTest,
        window.currentTest,
        window.activeTest
      ];

      for (const test of candidates) {
        if (
          test &&
          Number.isFinite(
            Number(test.duration)
          ) &&
          Number(test.duration) > 0
        ) {
          return (
            Number(test.duration) * 60
          );
        }
      }
    } catch (_) {}

    const session =
      getLatestSession();

    const duration =
      num(
        session &&
        session.durationSeconds,
        0
      );

    return duration > 0
      ? duration
      : 0;
  }

  function authoritativeDurationSeconds() {
    /*
      Best source:
      actual CBT countdown.

      This avoids trusting a stale/wrong
      submittedAt/start timestamp pair.
    */
    const total =
      testDurationSeconds();

    const remaining =
      visibleTimerSeconds();

    if (
      total > 0 &&
      remaining >= 0 &&
      remaining <= total
    ) {
      const elapsed =
        total - remaining;

      if (elapsed > 0) {
        return Math.max(
          1,
          Math.round(elapsed)
        );
      }
    }

    /*
      Fallback:
      real start timestamp.
    */
    const started =
      startTimestamp();

    if (started > 0) {
      const now =
        Date.now();

      if (now >= started) {
        return Math.max(
          1,
          Math.round(
            (now - started) / 1000
          )
        );
      }
    }

    const session =
      getLatestSession();

    return num(
      session &&
      session.durationSeconds,
      0
    );
  }

  function patchOrbit() {
    const orbit =
      window.CBTAnalyzerOrbit;

    if (
      !orbit ||
      typeof orbit.getOrbitReport !==
        "function"
    ) {
      return false;
    }

    if (
      orbit.__rankerV11FinalSpeedFix
    ) {
      return true;
    }

    const original =
      orbit.getOrbitReport;

    orbit.getOrbitReport =
      function (session) {
        const report =
          original.call(
            this,
            session
          );

        if (
          !report ||
          !report.available
        ) {
          return report;
        }

        const seconds =
          authoritativeDurationSeconds();

        const answered =
          num(
            report.answered,
            0
          );

        if (
          seconds > 0 &&
          answered > 0
        ) {
          const speed =
            answered /
            (seconds / 60);

          report.durationSeconds =
            seconds;

          report.speedQuestionsPerMinute =
            Math.max(
              0,
              Math.min(
                300,
                speed
              )
            );
        }

        report.v11FinalSpeedFix =
          true;

        return report;
      };

    orbit.__rankerV11FinalSpeedFix =
      true;

    return true;
  }

  function deriveAction(result) {
    const retry =
      arr(RETRY_KEY);

    if (retry.length) {
      return {
        type:
          "TARGETED_RETRY",

        reason:
          "Pending mistakes require verified retry.",

        route:
          "./retry.html?source=ranker-v11"
      };
    }

    const post =
      read(
        POST_STATE,
        null
      );

    if (
      post &&
      Array.isArray(
        post.weakTopics
      ) &&
      post.weakTopics.length
    ) {
      const target =
        post.weakTopics[0];

      return {
        type:
          "TARGETED_PRACTICE",

        reason:
          "Weak topic requires targeted practice.",

        target,

        route:
          "./rankers-test-series.html?mode=targeted&topic=" +
          encodeURIComponent(
            target.topic || ""
          )
      };
    }

    const skipped =
      num(
        result &&
        result.skipped,
        0
      );

    if (skipped > 0) {
      return {
        type:
          "ATTEMPT_STRATEGY",

        reason:
          "Skipped questions require attempt-strategy review.",

        route:
          "./attempt.html"
      };
    }

    const accuracy =
      num(
        result &&
        result.accuracy,
        NaN
      );

    if (
      Number.isFinite(accuracy) &&
      accuracy < 85
    ) {
      return {
        type:
          "REVISION",

        reason:
          "Accuracy requires revision before the next test.",

        route:
          "./question-bank.html?mode=weak"
      };
    }

    return {
      type:
        "NEXT_TEST",

      reason:
        "Performance is ready for the next adaptive test.",

      route:
        "./rankers-test-series.html?mode=adaptive"
    };
  }

  function getAction() {
    const saved =
      read(
        POST_KEY,
        null
      );

    if (
      saved &&
      saved.action
    ) {
      return saved.action;
    }

    const result =
      getResult();

    if (!result) {
      return null;
    }

    const action =
      deriveAction(result);

    write(
      POST_KEY,
      {
        version:
          "V11.3",

        generatedAt:
          Date.now(),

        result,

        action
      }
    );

    write(
      NEXT_KEY,
      action
    );

    return action;
  }

  function renderAction() {
    const action =
      getAction();

    if (!action) {
      return false;
    }

    let box =
      document.getElementById(
        "rankerV11PostAction"
      );

    if (!box) {
      box =
        document.createElement(
          "section"
        );

      box.id =
        "rankerV11PostAction";

      box.style.cssText =
        "margin:16px 0;" +
        "padding:18px;" +
        "border:1px solid #dfe4ec;" +
        "border-radius:16px;" +
        "background:#fff;" +
        "position:relative;" +
        "z-index:20;" +
        "display:block;";
    }

    box.innerHTML =
      "<h2>🧠 Next Best Action</h2>" +
      "<p><b>" +
      String(
        action.type ||
        "NEXT_TEST"
      ) +
      "</b></p>" +
      "<p class='muted'>" +
      String(
        action.reason ||
        ""
      ) +
      "</p>" +
      (
        action.route
          ? "<button type='button' " +
            "id='rankerV11NextBtn'>" +
            "Continue →" +
            "</button>"
          : ""
      );

    /*
      Always place after Orbit/result content
      when possible. This prevents later result
      rendering from putting it somewhere hidden.
    */
    const orbit =
      document.querySelector(
        ".orbit-result-panel"
      ) ||
      document.querySelector(
        ".cbt-orbit-result-v2"
      ) ||
      document.querySelector(
        "[id*='orbit']"
      );

    const result =
      document.querySelector(
        ".result"
      );

    const review =
      document.querySelector(
        "#questionReview"
      ) ||
      document.querySelector(
        ".question-review"
      );

    if (
      orbit &&
      orbit.parentNode
    ) {
      orbit.parentNode.insertBefore(
        box,
        orbit.nextSibling
      );
    } else if (
      review &&
      review.parentNode
    ) {
      review.parentNode.insertBefore(
        box,
        review
      );
    } else if (
      result
    ) {
      result.appendChild(
        box
      );
    } else if (
      !box.parentNode
    ) {
      document.body.appendChild(
        box
      );
    }

    const btn =
      document.getElementById(
        "rankerV11NextBtn"
      );

    if (
      btn &&
      action.route
    ) {
      btn.onclick =
        function () {
          location.href =
            action.route;
        };
    }

    return true;
  }

  function refreshSpeedText() {
    const orbit =
      window.CBTAnalyzerOrbit;

    if (
      !orbit ||
      typeof orbit.getOrbitReport !==
        "function"
    ) {
      return;
    }

    const report =
      orbit.getOrbitReport();

    if (
      !report ||
      !report.available
    ) {
      return;
    }

    const speed =
      num(
        report.speedQuestionsPerMinute,
        0
      );

    /*
      Do not rewrite the whole result.
      Only update visible Speed text.
    */
    const nodes =
      document.querySelectorAll(
        "body *"
      );

    for (const el of nodes) {
      if (
        el.children.length !== 0
      ) {
        continue;
      }

      const text =
        String(
          el.textContent || ""
        );

      if (
        /Speed\s+\d+(?:\.\d+)?\s*Q\/min/i.test(
          text
        )
      ) {
        el.textContent =
          text.replace(
            /Speed\s+\d+(?:\.\d+)?\s*Q\/min/i,
            "Speed " +
            speed.toFixed(2) +
            " Q/min"
          );
      }
    }
  }

  function refresh() {
    patchOrbit();
    refreshSpeedText();
    renderAction();
  }

  function boot() {
    refresh();

    [
      100,
      300,
      700,
      1200,
      2000,
      3500,
      5000,
      8000
    ].forEach(
      function (delay) {
        setTimeout(
          refresh,
          delay
        );
      }
    );

    window.addEventListener(
      "cbt:orbit-ready",
      refresh
    );

    window.addEventListener(
      "cbt:result-ready",
      refresh
    );


  }

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
