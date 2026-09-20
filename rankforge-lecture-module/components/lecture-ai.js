(function () {
  "use strict";

  const AI_ENDPOINT = "https://rankforge-ai.adityakr221503.workers.dev/api/lecture-ai/explain";

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

      try {
        const response = await fetch(AI_ENDPOINT, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            action: "explain",
            mode: "NCERT_360_DISSECTION",
            mistakeMode: /mistake|wrong|re-explain/i.test(topic),
            topic: topic.trim(),
            lecture: {
              id: context.lectureId,
              title: context.title,
              subject: context.subject,
              chapter: context.chapter
            },
            transcriptContext: String(context.transcript || "").slice(0, 18000)
          })
        });

        if (!response.ok) {
          throw new Error("AI endpoint HTTP " + response.status);
        }

        const data = await response.json();

        return {
          ok: true,
          source: "ai",
          explanation: data.explanation || data.answer || "",
          ncertFocus: Array.isArray(data.ncertFocus) ? data.ncertFocus : [],
          definitions: Array.isArray(data.definitions) ? data.definitions : [],
          formulas: Array.isArray(data.formulas) ? data.formulas : [],
          reactions: Array.isArray(data.reactions) ? data.reactions : [],
          diagrams: Array.isArray(data.diagrams) ? data.diagrams : [],
          examples: Array.isArray(data.examples) ? data.examples : [],
          exceptions: Array.isArray(data.exceptions) ? data.exceptions : [],
          traps: Array.isArray(data.traps) ? data.traps : [],
          misconceptions: Array.isArray(data.misconceptions) ? data.misconceptions : [],
          practice: Array.isArray(data.practice) ? data.practice : [],
          revision: Array.isArray(data.revision) ? data.revision : [],
          verification: data.verification || "NCERT-first AI analysis"
        };
      } catch (_) {
        return {
          ok: true,
          source: "local",
          explanation:
            "NCERT 360° AI endpoint abhi reachable nahi hai. Secure Worker deploy hone ke baad chapter/topic ka complete structured NCERT dissection yahin generate hoga."
        };
      }
    }
  };
})();
