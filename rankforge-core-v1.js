/* RankForge Core Stability Layer */
(function () {
"use strict";

window.RankForgeCore = window.RankForgeCore || {};
const RF = window.RankForgeCore;

RF.version = "1.0.0";
RF.modules = RF.modules || {};

RF.register = function(name, api) {
  if (name && api) RF.modules[name] = api;
};

RF.normalizeQuestion = function(q, i) {
  if (!q || typeof q !== "object") return null;

  const text = q.question ?? q.text ?? q.questionText ?? q.prompt;
  let options = q.options ?? q.choices ?? q.answers;

  if (!Array.isArray(options)) {
    if (options && typeof options === "object") {
      options = Object.keys(options).sort().map(k => options[k]);
    } else {
      options = [];
    }
  }

  options = options.map(x =>
    typeof x === "object"
      ? String(x.text ?? x.label ?? x.value ?? "")
      : String(x)
  );

  if (!text || options.length < 2) return null;

  let correct =
    q.correctAnswer ??
    q.correctIndex ??
    q.answer ??
    q.correct;

  if (typeof correct === "string") {
    const s = correct.trim();

    const exact = options.findIndex(x => x.trim() === s);

    if (exact >= 0) {
      correct = exact;
    } else if (/^[A-D]$/i.test(s)) {
      correct = s.toUpperCase().charCodeAt(0) - 65;
    } else if (/^\\d+$/.test(s)) {
      correct = Number(s);
    }
  }

  if (
    typeof correct === "number" &&
    Number.isInteger(correct) &&
    correct >= 1 &&
    correct <= options.length &&
    q.correctIndex === undefined
  ) {
    correct--;
  }

  if (
    !Number.isInteger(correct) ||
    correct < 0 ||
    correct >= options.length
  ) {
    correct = null;
  }

  return {
    ...q,
    id: q.id ?? q.questionId ?? ("rf-q-" + Date.now() + "-" + i),
    question: String(text),
    options,
    correctAnswer: correct
  };
};

RF.normalizeQuestions = function(list) {
  return (Array.isArray(list) ? list : [])
    .map(RF.normalizeQuestion)
    .filter(Boolean);
};

RF.reportError = function(module, error) {
  const message = String(error?.message || error || "Unknown error");

  console.error("RankForge [" + module + "]", error);

  try {
    const old = JSON.parse(
      localStorage.getItem("rankforgeRuntimeErrors") || "[]"
    );

    old.push({
      module,
      message,
      time: new Date().toISOString()
    });

    localStorage.setItem(
      "rankforgeRuntimeErrors",
      JSON.stringify(old.slice(-30))
    );
  } catch (_) {}
};

RF.refresh = function() {
  sessionStorage.setItem(
    "rankforgeRefreshTarget",
    location.href
  );

  location.reload();
};

RF.health = function() {
  return {
    core: true,
    version: RF.version,
    modules: Object.keys(RF.modules),
    questionNormalizer:
      typeof RF.normalizeQuestion === "function",
    refresh:
      typeof RF.refresh === "function"
  };
};

/* One delegated event layer for dynamic buttons */
document.addEventListener("click", function(e) {

  const refresh = e.target.closest("[data-rankforge-refresh]");

  if (refresh) {
    e.preventDefault();
    RF.refresh();
    return;
  }

  const go = e.target.closest("[data-go]");

  if (go) {
    const target = go.getAttribute("data-go");

    if (target && target !== "#") {
      e.preventDefault();
      location.href = target;
    }
  }

}, true);

/* Catch errors instead of silently breaking the application */
window.addEventListener("error", function(e) {
  RF.reportError(
    "Global",
    e.error || e.message
  );
});

window.addEventListener("unhandledrejection", function(e) {
  RF.reportError(
    "Promise",
    e.reason
  );
});

window.dispatchEvent(
  new CustomEvent("rankforge:core-ready", {
    detail: RF
  })
);

})();
