/* TEST 180 → RANK BOOSTER IMPORTER
   Safe importer — Biology 360 Revision Sheet untouched.
*/
(function () {
  function importTest180Questions(questions) {
    if (!Array.isArray(questions)) {
      return { added: 0, rejected: 0, reason: "Invalid questions array" };
    }

    let added = 0;
    let rejected = 0;

    questions.forEach(function (q, index) {
      if (!q || !q.question || !Array.isArray(q.options) || q.options.length !== 4) {
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

      if (typeof window.addRankBoosterQuestion === "function") {
        if (window.addRankBoosterQuestion(question)) {
          added++;
        } else {
          rejected++;
        }
      } else {
        rejected++;
      }
    });

    return { added: added, rejected: rejected };
  }

  window.importTest180Questions = importTest180Questions;
})();
