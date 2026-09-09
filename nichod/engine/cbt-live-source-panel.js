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
    let panel = document.getElementById("pcbCbtLiveSourcePanel");

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "pcbCbtLiveSourcePanel";

      panel.style.cssText =
        "display:none !important;" +
        "position:fixed;left:12px;right:12px;bottom:12px;" +
        "z-index:999999;background:#111827;color:#fff;" +
        "padding:12px;border-radius:14px;" +
        "font:13px/1.5 system-ui,sans-serif;" +
        "box-shadow:0 8px 30px rgba(0,0,0,.3);" +
        "max-height:42vh;overflow:auto;" +
        "pointer-events:none;";

      document.body.appendChild(panel);
    }

    panel.style.setProperty(
      "display",
      "none",
      "important"
    );

    panel.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );

    const x = inspect();

    panel.innerHTML =
      "<b>PCB CBT LIVE SOURCE</b>" +
      "<div>Source: " + escapeHtml(x.source) + "</div>" +
      "<div>Test ID: " + escapeHtml(x.testId) + "</div>" +
      "<div>Active Questions: <b>" + x.questions + "</b></div>" +
      "<div>PDF Bank: " + x.pdfQuestions + "</div>" +
      "<div>Ranker Bank: " + x.rankerQuestions + "</div>" +
      "<div>Authoritative: " +
      (x.authoritative ? "✅ YES" : "❌ NO") +
      "</div>" +
      "<div style='display:flex;gap:8px;margin-top:8px;'>" +
      "<button id='pcbCbtLiveRefresh' " +
      "style='padding:7px 10px;border:0;border-radius:8px;cursor:pointer'>" +
      "Refresh</button>" +
      "<button id='pcbCbtLiveMinimize' " +
      "style='padding:7px 10px;border:0;border-radius:8px;cursor:pointer'>" +
      "Minimize</button>" +
      "</div>";

    document.getElementById("pcbCbtLiveRefresh").onclick = render;

    document.getElementById("pcbCbtLiveMinimize").onclick =
      function () {
        panel.style.maxHeight = "42px";
        panel.style.overflow = "hidden";

        const buttons =
          panel.querySelectorAll("button");

        if (buttons.length > 1) {
          buttons[1].textContent = "Open";
          buttons[1].onclick = function () {
            panel.style.maxHeight = "42vh";
            panel.style.overflow = "auto";
            buttons[1].textContent = "Minimize";
          };
        }
      };
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
