(function () {
  "use strict";

  function read(key) {
    try {
      const x = localStorage.getItem(key);
      return x ? JSON.parse(x) : null;
    } catch (_) {
      return null;
    }
  }

  function getQuestions(x) {
    if (Array.isArray(x)) return x;
    if (x && Array.isArray(x.questions)) return x.questions;
    if (x && Array.isArray(x.items)) return x.items;
    return [];
  }

  function inspect() {
    const active = read("CBT_ACTIVE_TEST");
    const pdf = read("pdfCbtQuestions");
    const ranker = read("rbSelectedQuestions");

    const activeQ = getQuestions(active);

    let source =
      (active && active.source) ||
      localStorage.getItem("CBT_ACTIVE_SOURCE") ||
      sessionStorage.getItem("CBT_ACTIVE_SOURCE") ||
      "UNKNOWN";

    return {
      source: source,
      testId: active && (active.id || active.testId) || "—",
      questions: activeQ.length,
      pdfQuestions: getQuestions(pdf).length,
      rankerQuestions: getQuestions(ranker).length,
      authoritative:
        !!window.PCBAuthoritativeQuestionSource &&
        window.PCBAuthoritativeQuestionSource.hasQuestions()
    };
  }

  function render() {
    /*
     * Live source inspection remains available through
     * window.PCB_CBT_LIVE_SOURCE_PANEL.inspect().
     * The floating diagnostic panel is production-hidden.
     */
    const panel =
      document.getElementById(
        "pcbCbtLiveSourcePanel"
      );

    if (panel)
      panel.remove();

    return null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function boot() {
    if (document.body) {
      setTimeout(render, 500);
    } else {
      document.addEventListener("DOMContentLoaded", render, {
        once: true
      });
    }
  }

  boot();

  window.PCB_CBT_LIVE_SOURCE_PANEL = {
    inspect: inspect,
    render: render
  };
})();


/* NICHOD LIVE SOURCE: never block CBT underneath */
(function () {
  function allowCBTClicks() {
    const panels = document.querySelectorAll(
      "#pcbCbtLiveSourcePanel," +
      '[id*="pcb"],' +
      '[id*="nichod"],' +
      ".pcb-nichod-live-source"
    );

    panels.forEach(function (panel) {
      if (!panel || panel === document.body) return;

      const id =
        String(panel.id || "").toLowerCase();

      const className =
        String(panel.className || "").toLowerCase();

      const isNichodPanel =
        id.includes("pcb") ||
        id.includes("nichod") ||
        className.includes("pcb-nichod");

      if (!isNichodPanel) return;

      /*
       * IMPORTANT:
       * The floating diagnostics panel must NEVER create a
       * touch/click layer over CBT questions.
       */
      panel.style.setProperty(
        "pointer-events",
        "none",
        "important"
      );

      panel.style.setProperty(
        "touch-action",
        "none",
        "important"
      );

      /*
       * Keep only the panel's own controls interactive.
       */
      panel.querySelectorAll(
        "button, input, select, textarea, a"
      ).forEach(function (el) {
        el.style.setProperty(
          "pointer-events",
          "auto",
          "important"
        );

        el.style.setProperty(
          "touch-action",
          "manipulation",
          "important"
        );
      });
    });
  }

  allowCBTClicks();

  if (window.MutationObserver) {
    new MutationObserver(
      allowCBTClicks
    ).observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

  window.addEventListener(
    "resize",
    allowCBTClicks,
    { passive: true }
  );
})();
