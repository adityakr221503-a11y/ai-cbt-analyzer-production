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
        "position:fixed;left:12px;right:12px;bottom:12px;" +
        "z-index:999999;background:#111827;color:#fff;" +
        "padding:14px;border-radius:14px;" +
        "font:13px/1.5 system-ui,sans-serif;" +
        "box-shadow:0 8px 30px rgba(0,0,0,.3)";

      document.body.appendChild(panel);
    }

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
      "<button id='pcbCbtLiveRefresh' " +
      "style='margin-top:8px;padding:7px 10px;border:0;" +
      "border-radius:8px;cursor:pointer'>Refresh</button>";

    document.getElementById("pcbCbtLiveRefresh").onclick = render;
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
