/**
 * CBT Analyzer Pro
 * Production Core — Scoring Engine
 *
 * v9.1.1
 */

export function scoreAttempt({
  questions = [],
  answers = {},
  correctMarks = 4,
  negativeMarks = 1,
} = {}) {
  if (!Array.isArray(questions)) {
    throw new Error("Questions must be an array.");
  }

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  const questionResults = [];

  for (const question of questions) {
    const questionId = String(question.id);
    const answer = answers[questionId];

    const hasAnswer =
      answer !== undefined &&
      answer !== null &&
      String(answer).trim() !== "";

    if (!hasAnswer) {
      skipped++;

      questionResults.push({
        questionId,
        status: "skipped",
        selectedAnswer: null,
        correctAnswer: question.correctAnswer,
      });

      continue;
    }

    const isCorrect =
      String(answer) === String(question.correctAnswer);

    if (isCorrect) {
      correct++;

      questionResults.push({
        questionId,
        status: "correct",
        selectedAnswer: answer,
        correctAnswer: question.correctAnswer,
      });
    } else {
      incorrect++;

      questionResults.push({
        questionId,
        status: "incorrect",
        selectedAnswer: answer,
        correctAnswer: question.correctAnswer,
      });
    }
  }

  const score =
    correct * Number(correctMarks) -
    incorrect * Number(negativeMarks);

  return {
    score,
    correct,
    incorrect,
    skipped,
    attempted: correct + incorrect,
    total: questions.length,
    accuracy:
      correct + incorrect > 0
        ? Number(
            ((correct / (correct + incorrect)) * 100).toFixed(2)
          )
        : 0,
    questionResults,
  };
}
