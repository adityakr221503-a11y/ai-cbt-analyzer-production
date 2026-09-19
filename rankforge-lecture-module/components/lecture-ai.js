(function () {
  "use strict";

  const AI_ENDPOINT = "/api/lecture-ai/explain";
  const STORAGE = "rankforgeLectureAIContextV1";

  function getContext() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveContext(data) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
    } catch (_) {}
  }

  window.RankForgeLectureAI = {
    setLectureContext(lecture) {
      const context = {
        lectureId: lecture.id || "",
        title: lecture.title || "",
        subject: lecture.subjectName || "",
        chapter: lecture.chapterName || "",
        transcript: lecture.transcript || "",
        updatedAt: Date.now()
      };

      saveContext(context);
      return context;
    },

    async explain(topic) {
      const context = getContext();

      if (!topic || !topic.trim()) {
        return {
          ok: false,
          message: "Enter a concept to explain."
        };
      }

      /*
       * Secure future flow:
       * Browser -> authenticated server endpoint
       * Server -> authorized AI provider
       *
       * No API key is stored in this frontend.
       */

      try {
        const response = await fetch(AI_ENDPOINT, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          credentials: "include",
          body: JSON.stringify({
            action: "explain",
            topic: topic.trim(),
            lecture: {
              id: context.lectureId,
              title: context.title,
              subject: context.subject,
              chapter: context.chapter
            },
            transcriptContext: context.transcript || ""
          })
        });

        if (!response.ok) throw new Error("AI endpoint unavailable");

        const data = await response.json();

        return {
          ok: true,
          source: "ai",
          explanation: data.explanation || data.answer || ""
        };
      } catch (_) {
        return {
          ok: true,
          source: "local",
          explanation:
            "AI explanation is ready to connect. Once the secure AI endpoint and authorized lecture transcript are available, this section will generate a concept explanation, NCERT focus points, common traps and practice guidance."
        };
      }
    }
  };
})();