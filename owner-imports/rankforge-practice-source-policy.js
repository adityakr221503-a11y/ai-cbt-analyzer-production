(function () {
  "use strict";

  const APPROVED_KEY = "rankforgeCanonicalQuestionPoolV1";

  function isOwner() {
    return !!(
      window.RankForgeOwnerAccess &&
      window.RankForgeOwnerAccess.isOwner()
    );
  }

  function getApprovedForPractice() {
    /*
      Student practice receives only normalized approved questions.
      Source PDFs, provenance, audit records and owner metadata are
      deliberately excluded from the returned objects.
    */
    try {
      const raw = localStorage.getItem(APPROVED_KEY);
      if (!raw) return [];

      const data = JSON.parse(raw);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.questions)
          ? data.questions
          : [];

      return list.map(function (q) {
        return {
          id: q.id || q.questionId || undefined,
          question: q.question || q.text || "",
          options: Array.isArray(q.options)
            ? q.options.slice(0, 4)
            : [],
          correctAnswer:
            q.correctAnswer ??
            q.correctIndex ??
            undefined,
          subject: q.subject || "",
          chapter: q.chapter || "",
          topic: q.topic || "",
          difficulty: q.difficulty || ""
        };
      }).filter(function (q) {
        return q.question &&
               q.options.length === 4;
      });
    } catch (_) {
      return [];
    }
  }

  window.RankForgePracticeSourcePolicy = {
    isOwner,
    getApprovedForPractice
  };

  window.RankForgePracticeSourcePolicy.getApprovedForMasterPool =
    function () {
      try {
        if (
          window.RankForgeOwnerApprovedMasterPoolBridge &&
          typeof window.RankForgeOwnerApprovedMasterPoolBridge
            .getOwnerApprovedForMasterPool === "function"
        ) {
          return window.RankForgeOwnerApprovedMasterPoolBridge
            .getOwnerApprovedForMasterPool();
        }
      } catch (_) {}
      return [];
    };
})();
