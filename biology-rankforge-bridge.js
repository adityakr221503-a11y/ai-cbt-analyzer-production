(function () {
  "use strict";

  window.BiologyRankForgeBridge = {

    normalizeQuestion: function (q, index) {
      q = q || {};

      const options =
        Array.isArray(q.options) ? q.options :
        Array.isArray(q.choices) ? q.choices :
        [q.option_a, q.option_b, q.option_c, q.option_d]
          .filter(x => x != null)
          .map(String);

      let correct = -1;

      if (Number.isInteger(q.correctIndex)) {
        correct = q.correctIndex;
      } else if (Number.isInteger(q.answerIndex)) {
        correct = q.answerIndex;
      } else if (q.correctAnswer != null) {
        const a = String(q.correctAnswer).trim();
        const pos = options.findIndex(x => String(x).trim() === a);
        if (pos >= 0) correct = pos;
        else if (/^[A-D]$/i.test(a)) correct = a.toUpperCase().charCodeAt(0)-65;
        else if (/^[1-4]$/.test(a)) correct = Number(a)-1;
      } else if (q.answer != null) {
        const a = String(q.answer).trim();
        const pos = options.findIndex(x => String(x).trim() === a);
        if (pos >= 0) correct = pos;
        else if (/^[A-D]$/i.test(a)) correct = a.toUpperCase().charCodeAt(0)-65;
        else if (/^[1-4]$/.test(a)) correct = Number(a)-1;
      }

      return {
        id: q.id || ("BIO-NC-" + String(index + 1).padStart(6,"0")),
        question: String(q.question || q.text || ""),
        options: options,
        correctIndex: correct,
        correctAnswer:
          correct >= 0 && options[correct] != null
            ? String(options[correct])
            : String(q.correctAnswer || q.answer || ""),
        subject: "Biology",
        source: "BIOLOGY_ACTIVE_BANK",
        sourceVerified: true,
        mistakeType: q.mistakeType || "🧠 Conceptual",
        mistakeReason:
          q.mistakeReason ||
          "Review the NCERT concept and identify the reason for the incorrect response."
      };
    },

    normalizeResult: function (questions, answers) {
      questions = Array.isArray(questions) ? questions : [];
      answers = answers || {};

      return questions.map(function(q,i) {
        const nq = window.BiologyRankForgeBridge.normalizeQuestion(q,i);
        const selected =
          answers[i] != null ? answers[i] :
          answers[nq.id] != null ? answers[nq.id] :
          null;

        return Object.assign(nq,{
          selectedIndex:
            selected == null ? -1 : Number(selected),
          isCorrect:
            selected != null &&
            nq.correctIndex >= 0 &&
            Number(selected) === nq.correctIndex
        });
      });
    }
  };
})();
