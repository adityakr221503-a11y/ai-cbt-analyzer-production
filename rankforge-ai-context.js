(function () {
  "use strict";

  const KEY = "rankforgeAIMentorContextV1";

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_) {
      return fallback;
    }
  }

  function buildContext() {
    const lecture = read("rankforgeLectureAIContextV1", {});
    const practice = read("rankforgeLecturePracticeContextV1", {});
    const result = read("rankforgeLectureResultV1", null);
    const retry = read("rankforgeLectureRetryV1", null);

    return {
      source: "lecture-module",
      lecture: {
        id: lecture.lectureId || "",
        title: lecture.title || "",
        subject: lecture.subject || "",
        chapter: lecture.chapter || ""
      },
      practice: {
        questionCount: practice.questionCount || 0,
        lectureId: practice.lectureId || "",
        chapter: practice.chapter || ""
      },
      latestResult: result ? {
        score: result.score || 0,
        total: result.total || 0,
        correct: result.correct || 0,
        wrong: result.wrong || 0,
        skipped: result.skipped || 0,
        accuracy: result.accuracy || 0
      } : null,
      retry: retry || null,
      timestamp: Date.now()
    };
  }

  function publish(extra) {
    const context = Object.assign(buildContext(), extra || {});

    try {
      localStorage.setItem(KEY, JSON.stringify(context));

      /*
       * Custom event lets an already-loaded RankForge AI Mentor
       * consume the context without reloading the application.
       */
      window.dispatchEvent(
        new CustomEvent("rankforge:ai-context", {
          detail: context
        })
      );
    } catch (_) {}

    return context;
  }

  function get() {
    return read(KEY, buildContext());
  }

  window.RankForgeAIMentorContext = {
    build: buildContext,
    publish,
    get
  };

  document.addEventListener("DOMContentLoaded", function () {
    publish();
  });
})();