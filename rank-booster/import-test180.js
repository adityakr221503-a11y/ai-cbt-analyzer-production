(function () {
  async function importTest180Questions() {
    let questions;

    try {
      const response = await fetch("./test180-questions.json");

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      questions = await response.json();
    } catch (e) {
      console.error("Test 180: failed to load JSON.", e);
      return { added: 0, rejected: 180, error: e.message };
    }

    if (!Array.isArray(questions)) {
      return {
        added: 0,
        rejected: questions.length || 0,
        error: "Invalid JSON format"
      };
    }

    let added = 0;
    let rejected = 0;

    questions.forEach(function (q, index) {
      if (
        !q ||
        !q.question ||
        !Array.isArray(q.options) ||
        q.options.length !== 4
      ) {
        rejected++;
        return;
      }

      const question = {
        id: q.id || ("TEST180-" + (index + 1)),
        subject: q.subject || "",
        chapter: q.chapter || "Test 180",
        topic: q.topic || "",
        concept: q.concept || "",
        question: q.question,
        options: q.options,
        answer: q.correctAnswer || "",
        explanation: q.solution || "",
        difficulty: "NEET",
        questionType: "MCQ",
        source: q.source || "TEST180",
        ncertReference: q.ncertReference || "",
        syllabusReference: q.syllabusReference || "",
        commonTrap: q.commonTrap || "",
        tags: ["TEST180"]
      };

      if (!question.subject || !question.answer) {
        rejected++;
        return;
      }

      if (typeof window.addRankBoosterQuestion !== "function") {
        rejected++;
        return;
      }

      if (window.addRankBoosterQuestion(question)) {
        added++;
      } else {
        rejected++;
      }
    });

    return {
      added: added,
      rejected: rejected
    };
  }

  window.importTest180Questions = importTest180Questions;
})();
