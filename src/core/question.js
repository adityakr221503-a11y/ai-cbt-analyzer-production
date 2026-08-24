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
