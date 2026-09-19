(function () {
  "use strict";

  const RESULT_KEY = "rankforgeLectureResultV1";
  const MISTAKE_KEY = "rankforgeLectureMistakesV1";

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function getContext() {
    return read("rankforgeLectureAIContextV1", {});
  }

  function saveResult(result) {
    const context = getContext();

    const payload = {
      lectureId: context.lectureId || "",
      title: context.title || "",
      subject: context.subject || "",
      chapter: context.chapter || "",
      score: Number(result.score || 0),
      total: Number(result.total || 0),
      correct: Number(result.correct || 0),
      wrong: Number(result.wrong || 0),
      skipped: Number(result.skipped || 0),
      accuracy: Number(result.accuracy || 0),
      timestamp: Date.now()
    };

    write(RESULT_KEY, payload);

    const mistakes = read(MISTAKE_KEY, []);

    if (payload.wrong > 0) {
      mistakes.unshift({
        lectureId: payload.lectureId,
        lectureTitle: payload.title,
        subject: payload.subject,
        chapter: payload.chapter,
        wrong: payload.wrong,
        score: payload.score,
        timestamp: payload.timestamp
      });

      write(MISTAKE_KEY, mistakes.slice(0, 100));
    }

    renderResult(payload);
    return payload;
  }

  function renderResult(result) {
    const panel = document.getElementById("lectureResultPanel");
    if (!panel) return;

    const hasMistakes = result.wrong > 0;

    panel.innerHTML = `
      <div class="result-summary">
        <span class="result-icon">${hasMistakes ? "🧠" : "🎯"}</span>
        <div>
          <b>${hasMistakes ? "Let's improve this concept" : "Concept understood!"}</b>
          <small>${result.score}/${result.total} • ${result.accuracy}% accuracy</small>
        </div>
      </div>

      <div class="result-stats">
        <span>✅ ${result.correct} Correct</span>
        <span>❌ ${result.wrong} Wrong</span>
        <span>⏭️ ${result.skipped} Skipped</span>
      </div>

      <div class="result-actions">
        ${hasMistakes ? `
          <button data-result-action="explain">🤖 Re-explain Mistakes</button>
          <button data-result-action="retry">🔄 Retry Concept</button>
        ` : `
          <button data-result-action="next">🚀 Continue Learning</button>
        `}
      </div>
    `;

    panel.style.display = "block";
    panel.scrollIntoView({behavior: "smooth", block: "nearest"});
  }

  function getLastResult() {
    return read(RESULT_KEY, null);
  }

  function getMistakes() {
    return read(MISTAKE_KEY, []);
  }

  window.RankForgeLectureResult = {
    saveResult,
    getLastResult,
    getMistakes
  };

  document.addEventListener("click", function (event) {
    const action = event.target.closest("[data-result-action]");
    if (!action) return;

    const type = action.dataset.resultAction;
    const result = getLastResult();

    if (type === "explain") {
      const input = document.getElementById("aiConcept");

      if (input && result) {
        input.value =
          "Re-explain the mistakes from " +
          (result.title || "this lecture") +
          " in simple NCERT-focused terms.";

        input.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        document.getElementById("aiExplainBtn")?.click();
      }
    }

    if (type === "retry") {
      const context = getContext();

      try {
        localStorage.setItem(
          "rankforgeLectureRetryV1",
          JSON.stringify({
            lectureId: context.lectureId || "",
            title: context.title || "",
            chapter: context.chapter || "",
            fromResult: true,
            timestamp: Date.now()
          })
        );
      } catch (_) {}

      const practice =
        document.getElementById("startLecturePractice");

      if (practice) {
        practice.click();
      }
    }

    if (type === "next") {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  });
})();

document.addEventListener("DOMContentLoaded", function () {
  try {
    const result = window.RankForgeLectureResult?.getLastResult?.();

    if (result) {
      window.RankForgeAIMentorContext?.publish({
        event: "practice-result",
        result: result
      });
    }
  } catch (_) {}
});

window.addEventListener("rankforge:ai-context", function () {});
