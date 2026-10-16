(function () {
  /* The old function addRankBoosterQuestion no longer exists; the bank now exposes addImported(). */
  function hasQuestionBank() {
    return typeof window.addRankBoosterQuestion === "function" ||
      !!(window.RankBoosterQuestionBank && typeof window.RankBoosterQuestionBank.addImported === "function");
  }
  function addOne(question) {
    if (typeof window.addRankBoosterQuestion === "function") return !!window.addRankBoosterQuestion(question);
    return window.RankBoosterQuestionBank.addImported([question]) > 0;
  }

  function finish(r) {
    if (!r.error) {
      r.summary = "Imported " + r.added + " new questions (" + r.duplicates + " already there, " + r.rejected + " skipped because their options are pictures).";
    }
    window.__lastTest180Import = r;
    return r;
  }

  async function importTest180Questions() {
    let questions;

    async function load() {
      const response = await fetch("./test180-questions.json");
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      return response.json();
    }

    try {
      try {
        questions = await load();
      } catch (first) {
        await new Promise(function (resolve) { setTimeout(resolve, 500); });
        questions = await load();
      }
    } catch (e) {
      console.error("Test 180: failed to load JSON.", e);
      return finish({ added: 0, duplicates: 0, rejected: 0, error: "Could not load the Test 180 data (" + e.message + "). Check your connection and try again." });
    }

    if (!Array.isArray(questions)) {
      return finish({
        added: 0,
        duplicates: 0,
        rejected: questions.length || 0,
        error: "Invalid JSON format"
      });
    }

    let added = 0;
    let rejected = 0;
    function storedCount() {
      try { return JSON.parse(localStorage.getItem("rankBoosterQuestionBankV2") || "[]").length; } catch (e) { return 0; }
    }
    const before = storedCount();

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
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : undefined,
        correctAnswer: q.correctAnswer || "",
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

      if (!hasQuestionBank()) { console.error("IMPORT DEBUG: no question bank API available");
        rejected++;
        return;
      }

      if (addOne(question)) {
        added++;
      } else {
        rejected++;
      }
    });

    const net = Math.max(0, storedCount() - before);
    return finish({
      added: net,
      duplicates: Math.max(0, added - net),
      rejected: rejected
    });
  }

  window.importTest180Questions = importTest180Questions;
})();
