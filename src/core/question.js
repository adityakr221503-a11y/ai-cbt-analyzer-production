/**
 * CBT Analyzer Pro
 * Production Core — Question Model
 *
 * v9.1.1
 */

export function createQuestion({
  id,
  text,
  options = [],
  correctAnswer,
  subject = "",
  chapter = "",
  topic = "",
  concept = "",
  difficulty = "medium",
  marks = 4,
  negativeMarks = 1,
  explanation = "",
  source = "",
} = {}) {

  /* ---------------------------------------------
     BASIC VALIDATION
  --------------------------------------------- */

  if (!id) {
    throw new Error(
      "Question requires a unique id."
    );
  }

  if (
    !text ||
    !String(text).trim()
  ) {
    throw new Error(
      "Question requires question text."
    );
  }

  if (!Array.isArray(options)) {
    throw new Error(
      "Question options must be an array."
    );
  }

  if (options.length < 2) {
    throw new Error(
      "Question requires at least two options."
    );
  }


  /* ---------------------------------------------
     NORMALIZE OPTIONS
  --------------------------------------------- */

  const normalizedOptions =
    options.map(
      option => String(option)
    );


  /* ---------------------------------------------
     VALIDATE CORRECT ANSWER
  --------------------------------------------- */

  if (
    correctAnswer === undefined ||
    correctAnswer === null
  ) {
    throw new Error(
      "Question requires a correct answer."
    );
  }


  const normalizedCorrectAnswer =
    String(correctAnswer);


  /*
   * The correct answer can be stored as
   * either the actual option text or an
   * option index such as 0, 1, 2, 3.
   */

  let finalCorrectAnswer =
    normalizedCorrectAnswer;


  /*
   * If correctAnswer is a number-like
   * index, convert it to option text.
   */

  if (
    /^\d+$/.test(
      normalizedCorrectAnswer
    )
  ) {

    const index =
      Number(
        normalizedCorrectAnswer
      );


    if (
      index >= 0 &&
      index < normalizedOptions.length
    ) {

      finalCorrectAnswer =
        normalizedOptions[index];

    }

  }


  /*
   * Make sure the final answer exists
   * among the options.
   */

  if (
    !normalizedOptions.includes(
      finalCorrectAnswer
    )
  ) {

    throw new Error(
      "Correct answer must match one of the question options."
    );

  }


  /* ---------------------------------------------
     NORMALIZE MARKS
  --------------------------------------------- */

  const normalizedMarks =
    Number(marks);


  const normalizedNegativeMarks =
    Number(negativeMarks);


  if (
    !Number.isFinite(
      normalizedMarks
    ) ||
    normalizedMarks < 0
  ) {

    throw new Error(
      "Question marks must be a valid positive number."
    );

  }


  if (
    !Number.isFinite(
      normalizedNegativeMarks
    ) ||
    normalizedNegativeMarks < 0
  ) {

    throw new Error(
      "Question negative marks must be a valid number."
    );

  }


  /* ---------------------------------------------
     RETURN IMMUTABLE QUESTION
  --------------------------------------------- */

  return Object.freeze({

    id:
      String(id),

    text:
      String(text),

    options:
      Object.freeze(
        normalizedOptions
      ),

    correctAnswer:
      finalCorrectAnswer,

    subject:
      String(subject),

    chapter:
      String(chapter),

    topic:
      String(topic),

    concept:
      String(concept),

    difficulty:
      String(difficulty),

    marks:
      normalizedMarks,

    negativeMarks:
      normalizedNegativeMarks,

    explanation:
      String(explanation),

    source:
      String(source),

  });

}
/**
 * CBT Analyzer Pro
 * Production Core — Question Model
 *
 * v9.1.1
 */

export function createQuestion({
  id,
  text,
  options = [],
  correctAnswer,
  subject = "",
  chapter = "",
  topic = "",
  concept = "",
  difficulty = "medium",
  marks = 4,
  negativeMarks = 1,
  explanation = "",
  source = "",
} = {}) {

  if (!id) {
    throw new Error(
      "Question requires a unique id."
    );
  }

  if (
    !text ||
    !String(text).trim()
  ) {
    throw new Error(
      "Question requires question text."
    );
  }

  if (!Array.isArray(options)) {
    throw new Error(
      "Question options must be an array."
    );
  }

  if (options.length < 2) {
    throw new Error(
      "Question requires at least two options."
    );
  }

  const normalizedOptions =
    options.map(
      option => String(option)
    );

  if (
    correctAnswer === undefined ||
    correctAnswer === null
  ) {
    throw new Error(
      "Question requires a correct answer."
    );
  }

  const answer =
    String(correctAnswer);

  let finalCorrectAnswer =
    answer;

  /*
   * Support both:
   * correctAnswer: "Mars"
   * correctAnswer: 1
   */

  if (
    /^\d+$/.test(answer)
  ) {

    const index =
      Number(answer);

    if (
      index >= 0 &&
      index < normalizedOptions.length
    ) {

      finalCorrectAnswer =
        normalizedOptions[index];

    }
  }

  if (
    !normalizedOptions.includes(
      finalCorrectAnswer
    )
  ) {

    throw new Error(
      "Correct answer must match one of the question options."
    );

  }

  const normalizedMarks =
    Number(marks);

  const normalizedNegativeMarks =
    Number(negativeMarks);

  if (
    !Number.isFinite(
      normalizedMarks
    ) ||
    normalizedMarks < 0
  ) {

    throw new Error(
      "Question marks must be a valid number."
    );

  }

  if (
    !Number.isFinite(
      normalizedNegativeMarks
    ) ||
    normalizedNegativeMarks < 0
  ) {

    throw new Error(
      "Question negative marks must be a valid number."
    );

  }

  return Object.freeze({

    id:
      String(id),

    text:
      String(text),

    options:
      Object.freeze(
        normalizedOptions
      ),

    correctAnswer:
      finalCorrectAnswer,

    subject:
      String(subject),

    chapter:
      String(chapter),

    topic:
      String(topic),

    concept:
      String(concept),

    difficulty:
      String(difficulty),

    marks:
      normalizedMarks,

    negativeMarks:
      normalizedNegativeMarks,

    explanation:
      String(explanation),

    source:
      String(source)

  });

}
/**
 * CBT Analyzer Pro
 * Production Core — Attempt Engine
 *
 * v9.1.1
 */

import {
  addItem,
  getItem
} from "../storage/storage.js";


/* =====================================================
   CREATE ATTEMPT
===================================================== */

export function startAttempt({
  id,
  testId,
  startedAt = new Date().toISOString(),
  answers = {},
  status = "in-progress"
} = {}) {

  if (!id) {
    throw new Error(
      "Attempt requires a unique id."
    );
  }

  if (!testId) {
    throw new Error(
      "Attempt requires a test id."
    );
  }

  return {
    id: String(id),
    testId: String(testId),
    startedAt: String(startedAt),
    submittedAt: null,
    answers: {
      ...answers
    },
    status: String(status)
  };
}


/* =====================================================
   SAVE ANSWER
===================================================== */

export function saveAnswer(
  attempt,
  questionId,
  answer
) {

  if (!attempt) {
    throw new Error(
      "Attempt is required."
    );
  }

  if (!questionId) {
    throw new Error(
      "Question id is required."
    );
  }

  const updatedAttempt = {
    ...attempt,

    answers: {
      ...(attempt.answers || {}),
      [String(questionId)]:
        answer
    }
  };

  /*
   * Persist the attempt.
   */

  addItem(
    "attempts",
    updatedAttempt
  );

  return updatedAttempt;
}


/* =====================================================
   GET SAVED ANSWER
===================================================== */

export function getSavedAnswer(
  attempt,
  questionId
) {

  if (
    !attempt ||
    !attempt.answers
  ) {
    return null;
  }

  return (
    attempt.answers[
      String(questionId)
    ] ?? null
  );
}


/* =====================================================
   SUBMIT ATTEMPT
===================================================== */

export function submitAttempt({
  attempt,
  questions = [],
  correctMarks = 4,
  negativeMarks = 1
} = {}) {

  if (!attempt) {
    throw new Error(
      "Attempt is required."
    );
  }

  if (!Array.isArray(questions)) {
    throw new Error(
      "Questions must be an array."
    );
  }

  const answers =
    attempt.answers || {};


  let correct = 0;

  let incorrect = 0;

  let skipped = 0;

  let attempted = 0;

  let score = 0;


  const questionResults = [];


  questions.forEach(
    function(question) {

      const questionId =
        String(question.id);

      const userAnswer =
        answers[questionId];


      const hasAnswer =
        userAnswer !== undefined &&
        userAnswer !== null &&
        String(userAnswer).trim() !== "";


      if (!hasAnswer) {

        skipped++;


        questionResults.push({

          questionId,

          answer: null,

          correctAnswer:
            question.correctAnswer,

          status: "skipped",

          marks: 0

        });

        return;

      }


      attempted++;


      const isCorrect =
        String(userAnswer) ===
        String(question.correctAnswer);


      if (isCorrect) {

        correct++;

        score += Number(
          question.marks ??
          correctMarks
        );


        questionResults.push({

          questionId,

          answer: userAnswer,

          correctAnswer:
            question.correctAnswer,

          status: "correct",

          marks:
            Number(
              question.marks ??
              correctMarks
            )

        });

      } else {

        incorrect++;

        score -= Number(
          question.negativeMarks ??
          negativeMarks
        );


        questionResults.push({

          questionId,

          answer: userAnswer,

          correctAnswer:
            question.correctAnswer,

          status: "incorrect",

          marks:
            -Number(
              question.negativeMarks ??
              negativeMarks
            )

        });

      }

    }
  );


  /*
   * Prevent negative final scores
   * only if your scoring system requires
   * that behaviour.
   *
   * Current CBT system keeps the
   * actual negative score.
   */


  const total =
    questions.length;


  const accuracy =
    attempted > 0
      ? Number(
          (
            correct /
            attempted *
            100
          ).toFixed(2)
        )
      : 0;


  const submittedAt =
    new Date().toISOString();


  const completedAttempt = {

    ...attempt,

    answers: {
      ...answers
    },

    submittedAt,

    status:
      "submitted",

    score: {
      score:
        Number(
          score.toFixed(2)
        ),

      total,

      attempted,

      correct,

      incorrect,

      skipped,

      accuracy
    },

    questionResults

  };


  /*
   * Save final attempt.
   */

  addItem(
    "attempts",
    completedAttempt
  );


  /*
   * Create mistake records.
   *
   * We intentionally keep this section
   * compatible with the existing mistake
   * engine without making CBT adaptive.
   */

  let mistakes = [];


  try {

    const mistakeEngine =
      window.__CBT_MISTAKE_ENGINE__;


    if (
      mistakeEngine &&
      typeof mistakeEngine
        .createMistakesFromAttempt ===
        "function"
    ) {

      mistakes =
        mistakeEngine
          .createMistakesFromAttempt(
            completedAttempt,
            questions
          ) || [];

    }

  } catch (error) {

    console.warn(
      "Mistake engine was not connected:",
      error
    );

  }


  return {

    attempt:
      completedAttempt,

    score:
      completedAttempt.score,

    questionResults,

    mistakes

  };

}


/* =====================================================
   LOAD ATTEMPT
===================================================== */

export function getAttempt(
  attemptId
) {

  return getItem(
    "attempts",
    attemptId
  );

}
