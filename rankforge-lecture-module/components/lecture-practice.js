(function () {
  "use strict";

  const QUESTION_BANK_URL = "../../question-bank.html";
  const CBT_URL = "../../cbt.html";

  function getLectureContext() {
    try {
      return JSON.parse(
        localStorage.getItem("rankforgeLectureAIContextV1") || "{}"
      );
    } catch (_) {
      return {};
    }
  }

  function findBank() {
    const candidates = [
      window.RankerUnifiedBank,
      window.RANKFORGE_UNIFIED_BANK,
      window.RankForgeQuestionBank,
      window.QuestionBank
    ];

    return candidates.find(Boolean) || null;
  }

  function getQuestions(bank, context) {
    if (!bank) return [];

    let questions = [];

    if (Array.isArray(bank)) {
      questions = bank;
    } else if (Array.isArray(bank.questions)) {
      questions = bank.questions;
    } else if (typeof bank.getQuestions === "function") {
      try {
        questions = bank.getQuestions();
      } catch (_) {
        questions = [];
      }
    }

    if (!Array.isArray(questions)) return [];

    const terms = [
      context.title,
      context.chapter,
      context.subject
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .filter(x => x.length > 2);

    if (!terms.length) return questions.slice(0, 5);

    const matched = questions.filter(q => {
      const text = JSON.stringify(q).toLowerCase();
      return terms.some(term => text.includes(term));
    });

    return matched.slice(0, 10);
  }

  function launch() {
    const context = getLectureContext();
    const bank = findBank();
    const questions = getQuestions(bank, context);

    try {
      localStorage.setItem(
        "rankforgeLecturePracticeContextV1",
        JSON.stringify({
          lectureId: context.lectureId || "",
          title: context.title || "",
          subject: context.subject || "",
          chapter: context.chapter || "",
          questionCount: questions.length,
          createdAt: Date.now()
        })
      );
    } catch (_) {}

    const status = document.getElementById("practiceStatus");

    if (questions.length) {
      status.innerHTML =
        "✅ " + questions.length +
        " lecture-linked questions found. Opening RankForge practice.";

      /*
       * Keep the existing RankForge question system as the source
       * of truth. No duplicate question engine is created here.
       */
      setTimeout(() => {
        window.location.href =
          QUESTION_BANK_URL +
          "?lecture=" +
          encodeURIComponent(context.lectureId || "") +
          "&chapter=" +
          encodeURIComponent(context.chapter || "");
      }, 350);

      return;
    }

    status.innerHTML =
      "📚 No direct lecture match was found yet. " +
      "Opening the existing RankForge Question Bank so practice can continue.";

    setTimeout(() => {
      window.location.href = QUESTION_BANK_URL;
    }, 350);
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest("#startLecturePractice")) {
      launch();
    }

    if (event.target.closest("#openQuestionBank")) {
      window.location.href = QUESTION_BANK_URL;
    }
  });

  window.RankForgeLecturePractice = {
    launch,
    getLectureContext,
    getQuestions
  };
})();