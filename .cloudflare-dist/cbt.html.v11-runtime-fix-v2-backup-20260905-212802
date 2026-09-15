/* =========================================================
   RANKER V11.1 — RUNTIME REPAIR
   ADDITIVE ONLY
   Fixes:
   1. Orbit speed from authoritative CBT start time
   2. Reliable V11 POST / Next Best Action rendering
========================================================= */
(function () {
  "use strict";

  const ACTIVE_START = "CBT_ACTIVE_STARTED_AT";
  const POST_KEY = "cbtRankerPostActionV11";
  const NEXT_KEY = "cbtNextBestActionV5";
  const RETRY_KEY = "cbtAnalyzer.retryQueue";
  const POST_STATE = "cbtPostTestStateV8";

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
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function arr(key) {
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function activeStartedAt() {
    const session =
      Number(sessionStorage.getItem(ACTIVE_START) || 0);

    const local =
      Number(localStorage.getItem(ACTIVE_START) || 0);

    return session || local || 0;
  }

  function getLatestSession() {
    const sessions =
      read("cbtTestSessions", []);

    if (!Array.isArray(sessions) || !sessions.length) {
      return null;
    }

    return sessions[sessions.length - 1];
  }

  function getResult() {
    const candidates = [
      read("cbtCoreResultV6", null),
      read("cbtCoreResultV5", null),
      read("cbtHistory", []),
      read("cbtTestSessions", [])
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        const x = candidate[candidate.length - 1];
        if (x && typeof x === "object") {
          return x;
        }
      }

      if (
        candidate &&
        typeof candidate === "object"
      ) {
        if (
          candidate.result &&
          typeof candidate.result === "object"
        ) {
          return candidate.result;
        }

        return candidate;
      }
    }

    return null;
  }

  /* =====================================================
     AUTHORITATIVE SPEED
  ===================================================== */

  function authoritativeDurationSeconds(session) {
    const started = activeStartedAt();

    if (started > 0) {
      const submitted =
        Date.parse(
          session &&
          (
            session.submittedAt ||
            session.completedAt
          )
        );

      if (
        Number.isFinite(submitted) &&
        submitted >= started
      ) {
        return Math.max(
          1,
          Math.round(
            (submitted - started) / 1000
          )
        );
      }

      const now = Date.now();

      if (now >= started) {
        return Math.max(
          1,
          Math.round(
            (now - started) / 1000
          )
        );
      }
    }

    const stored =
      num(
        session &&
        session.durationSeconds,
        0
      );

    return stored > 0 ? stored : 0;
  }

  function patchOrbit() {
    if (
      !window.CBTAnalyzerOrbit ||
      typeof window.CBTAnalyzerOrbit.getOrbitReport !==
        "function"
    ) {
      return false;
    }

    if (
      window.CBTAnalyzerOrbit
        .__rankerV11RuntimeFixed
    ) {
      return true;
    }

    const original =
      window.CBTAnalyzerOrbit.getOrbitReport;

    window.CBTAnalyzerOrbit.getOrbitReport =
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

        const actualSession =
          session ||
          getLatestSession();

        const seconds =
          authoritativeDurationSeconds(
            actualSession
          );

        const answered =
          num(
            report.answered,
            0
          );

        if (
          seconds > 0 &&
          answered > 0
        ) {
          report.durationSeconds =
            seconds;

          report.speedQuestionsPerMinute =
            answered /
            (seconds / 60);

          report.speedQuestionsPerMinute =
            Math.max(
              0,
              Math.min(
                300,
                report.speedQuestionsPerMinute
              )
            );
        }

        report.v11RuntimeFixed = true;

        return report;
      };

    window.CBTAnalyzerOrbit
      .__rankerV11RuntimeFixed = true;

    return true;
  }

  /* =====================================================
     NEXT BEST ACTION
  ===================================================== */

  function deriveAction(result) {
    const retry =
      arr(RETRY_KEY);

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
      read(POST_STATE, null);

    if (
      post &&
      Array.isArray(post.weakTopics) &&
      post.weakTopics.length
    ) {
      const target =
        post.weakTopics[0];

      return {
        type: "TARGETED_PRACTICE",
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
        type: "ATTEMPT_STRATEGY",
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

  function ensurePostAction() {
    const path =
      String(
        location.pathname || ""
      ).toLowerCase();

    if (!path.endsWith("cbt.html")) {
      return false;
    }

    const lifecycle =
      window.RankerV11Lifecycle;

    if (!lifecycle) {
      return false;
    }

    const result =
      getResult();

    if (!result) {
      return false;
    }

    const existing =
      read(
        POST_KEY,
        null
      );

    if (
      existing &&
      existing.action
    ) {
      renderAction(existing.action);
      return true;
    }

    const action =
      deriveAction(result);

    const payload = {
      version: "V11.1",
      generatedAt:
        Date.now(),
      result,
      action
    };

    write(
      POST_KEY,
      payload
    );

    write(
      NEXT_KEY,
      action
    );

    renderAction(action);

    return true;
  }

  function renderAction(action) {
    if (
      !action ||
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
      "border-radius:16px;" +
      "background:#fff;";

    const button =
      action.route
        ? "<button type='button' " +
          "id='rankerV11NextBtn'>" +
          "Continue →" +
          "</button>"
        : "";

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
      button;

    const anchors = [
      "#questionReview",
      ".question-review",
      "#orbitAnalysis",
      "#orbit",
      "main"
    ];

    let anchor = null;

    for (const selector of anchors) {
      anchor =
        document.querySelector(
          selector
        );

      if (anchor) break;
    }

    if (
      anchor &&
      anchor.parentNode
    ) {
      anchor.parentNode.insertBefore(
        box,
        anchor
      );
    } else {
      document.body.appendChild(
        box
      );
    }

    const btn =
      document.getElementById(
        "rankerV11NextBtn"
      );

    if (btn && action.route) {
      btn.onclick =
        function () {
          location.href =
            action.route;
        };
    }
  }

  function refresh() {
    patchOrbit();

    const report =
      window.CBTAnalyzerOrbit &&
      typeof window.CBTAnalyzerOrbit.getOrbitReport ===
        "function"
        ? window.CBTAnalyzerOrbit.getOrbitReport()
        : null;

    if (report) {
      const speed =
        document.querySelector(
          "#metrics"
        );

      if (speed) {
        const text =
          speed.innerHTML;

        speed.innerHTML =
          text.replace(
            /Speed[^<]*Q\/min/g,
            "Speed " +
            report.speedQuestionsPerMinute
              .toFixed(2) +
            " Q/min"
          );
      }
    }

    ensurePostAction();
  }

  function boot() {
    refresh();

    [250, 750, 1500, 2500, 4000, 6000].forEach(
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
