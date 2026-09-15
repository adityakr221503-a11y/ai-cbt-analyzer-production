/**
 * CBT Analyzer Pro
 * Production Core — Attempt Model
 *
 * v9.1.1
 */

export function createAttempt({
  id,
  testId,
  studentId = null,
  answers = {},
  startedAt = new Date().toISOString(),
  submittedAt = null,
  status = "in-progress",
  score = null,
  correct = 0,
  incorrect = 0,
  skipped = 0,
  timeSpentSeconds = 0,
} = {}) {
  if (!id) {
    throw new Error("Attempt requires a unique id.");
  }

  if (!testId) {
    throw new Error("Attempt requires a testId.");
  }

  if (!["in-progress", "completed", "abandoned"].includes(status)) {
    throw new Error(`Invalid attempt status: ${status}`);
  }

  return Object.freeze({
    id: String(id),
    testId: String(testId),
    studentId: studentId === null ? null : String(studentId),

    answers: { ...answers },

    startedAt: String(startedAt),
    submittedAt:
      submittedAt === null ? null : String(submittedAt),

    status,

    score: score === null ? null : Number(score),
    correct: Number(correct),
    incorrect: Number(incorrect),
    skipped: Number(skipped),
    timeSpentSeconds: Number(timeSpentSeconds),
  });
}
