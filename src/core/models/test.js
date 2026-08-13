/**
 * CBT Analyzer Pro
 * Production Core — Test Model
 *
 * v9.1.1
 */

export function createTest({
  id,
  title,
  subject = "",
  exam = "NEET",
  durationMinutes = 180,
  questions = [],
  totalMarks = null,
  negativeMarking = true,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!id) {
    throw new Error("Test requires a unique id.");
  }

  if (!title || !String(title).trim()) {
    throw new Error("Test requires a title.");
  }

  if (!Array.isArray(questions)) {
    throw new Error("Test questions must be an array.");
  }

  const normalizedQuestions = questions.map((questionId) =>
    String(questionId)
  );

  const calculatedMarks =
    totalMarks === null
      ? normalizedQuestions.length * 4
      : Number(totalMarks);

  return Object.freeze({
    id: String(id),
    title: String(title),
    subject: String(subject),
    exam: String(exam),
    durationMinutes: Number(durationMinutes),
    questions: normalizedQuestions,
    totalMarks: calculatedMarks,
    negativeMarking: Boolean(negativeMarking),
    createdAt: String(createdAt),
  });
}
