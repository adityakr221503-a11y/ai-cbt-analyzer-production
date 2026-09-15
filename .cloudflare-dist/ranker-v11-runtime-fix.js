/* =========================================================
   RANKER V11.4 — LIGHTWEIGHT RESULT-ONLY RUNTIME LAYER
   ADDITIVE ONLY
   Active CBT is NEVER touched.
========================================================= */
(function () {
  "use strict";

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

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function arr(key) {
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  }

  /*
    CRITICAL:
    This layer must NEVER run during an active CBT.
  */
  function resultScreenReady() {
    const result =
      document.getElementById("result");

    if (!result) return false;

    const style =
      window.getComputedStyle(result);

    if (
      style.display === "none" ||
      style.visibility === "hidden"
    ) {
      return false;
    }

    return true;
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

        if (r && typeof r === "object") {
          return r;
        }
      }
    } catch (_) {}

    for (
      const key of [
        "cbtCoreResultV6",
        "cbtCoreResultV5"
      ]
    ) {
      const r = read(key, null);

      if (r && typeof r === "object") {
        return r.result &&
          typeof r.result === "object"
          ? r.result
          : r;
      }
    }

    const history =
      read("cbtHistory", []);

    if (
      Array.isArray(history) &&
      history.length
    ) {
      return history[history.length - 1];
    }

    return null;
  }

  function deriveAction(result) {
    const retry = arr(RETRY_KEY);

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
        result && result.skipped,
        0
      );

    if (skipped > 0) {
      return {
        type: "ATTEMPT_STRATEGY",
        reason:
          "Skipped questions require attempt-strategy review.",
        route: "./attempt.html"
      };
    }

    const accuracy =
      num(
        result && result.accuracy,
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

  function getAction() {
    const result = getResult();

    if (!result) return null;

    const action =
      deriveAction(result);

    write(
      POST_KEY,
      {
        version: "V11.4",
        generatedAt: Date.now(),
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
    if (!resultScreenReady()) {
      return false;
    }

    const action = getAction();

    if (!action) return false;

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
        action.reason || ""
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

    const orbit =
      document.querySelector(
        ".orbit-result-panel"
      ) ||
      document.querySelector(
        ".cbt-orbit-result-v2"
      );

    const result =
      document.getElementById(
        "result"
      );

    const review =
      document.getElementById(
        "questionReview"
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
    } else if (result) {
      result.appendChild(box);
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

    return true;
  }

  /*
    Speed correction is deliberately result-only.
    No body-wide scanning during CBT.
  */
  function patchSpeedAfterResult() {
    if (!resultScreenReady()) return;

    try {
      const orbit =
        window.CBTAnalyzerOrbit;

      if (
        !orbit ||
        typeof orbit.getOrbitReport !==
          "function"
      ) {
        return;
      }

      if (
        orbit.__rankerV11SpeedPatch
      ) {
        return;
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

          /*
            Prefer already-recorded real duration.
            Never scan the active CBT timer.
          */
          const seconds =
            num(
              report.durationSeconds,
              num(
                session &&
                session.durationSeconds,
                0
              )
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
              Math.max(
                0,
                Math.min(
                  300,
                  answered /
                  (seconds / 60)
                )
              );
          }

          return report;
        };

      orbit.__rankerV11SpeedPatch =
        true;

    } catch (_) {}
  }

  function runOnce() {
    /*
      HARD GATE:
      absolutely nothing happens on active CBT screen.
    */
    if (!resultScreenReady()) {
      return;
    }

    patchSpeedAfterResult();
    renderAction();
  }

  function boot() {
    /*
      No interval.
      No MutationObserver.
      No body-wide DOM scan.
      No repeated refresh loop.
    */

    runOnce();

    window.addEventListener(
      "cbt:result-ready",
      function () {
        setTimeout(
          runOnce,
          0
        );
      },
      { once: false }
    );

    window.addEventListener(
      "cbt:orbit-ready",
      function () {
        if (
          resultScreenReady()
        ) {
          runOnce();
        }
      },
      { once: false }
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();
