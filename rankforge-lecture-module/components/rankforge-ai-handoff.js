(function () {
  "use strict";

  /*
   * This is deliberately a handoff layer.
   * It does NOT expose an API key and does NOT create another AI.
   */

  function getContext() {
    return window.RankForgeAIMentorContext?.get?.() || {};
  }

  function buildPrompt(intent) {
    const c = getContext();
    const lecture = c.lecture || {};
    const result = c.latestResult || {};

    return [
      "RankForge AI Mentor context:",
      "Subject: " + (lecture.subject || ""),
      "Chapter: " + (lecture.chapter || ""),
      "Lecture: " + (lecture.title || ""),
      "Practice score: " +
        (result.score ?? "not available") +
        "/" +
        (result.total ?? "not available"),
      "Accuracy: " + (result.accuracy ?? "not available") + "%",
      "Wrong: " + (result.wrong ?? "not available"),
      "Intent: " + (intent || "explain concept"),
      "",
      "Explain using NCERT-first reasoning, identify the conceptual gap,",
      "give a simple example, then provide one short retry strategy."
    ].join("\n");
  }

  window.RankForgeLectureAIHandoff = {
    getContext,
    buildPrompt
  };
})();