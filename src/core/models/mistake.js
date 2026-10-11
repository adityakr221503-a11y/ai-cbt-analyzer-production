/**
 * CBT Analyzer Pro
 * Production Core — Mistake Model
 *
 * v9.1.1
 */

const VALID_REASONS = [
  "concept_gap",
  "calculation_error",
  "silly_mistake",
  "misread_question",
  "guess",
  "time_pressure",
  "forgotten_fact",
  "application_error",
  "unknown",
];

const VALID_STATUS = [
  "new",
  "learning",
  "practicing",
  "improving",
  "mastered",
];

export function createMistake({
  id,
  studentId = null,
  attemptId,
  questionId,
  reason = "unknown",
  explanation = "",
  confidence = 0,
  status = "new",
  practiceCount = 0,
  successfulAttempts = 0,
  createdAt = new Date().toISOString(),
  lastPracticedAt = null,
  nextReviewAt = null,
} = {}) {
  if (!id) throw new Error("Mistake requires a unique id.");
  if (!attemptId) throw new Error("Mistake requires an attemptId.");
  if (!questionId) throw new Error("Mistake requires a questionId.");

  if (!VALID_REASONS.includes(reason)) {
    throw new Error(`Invalid mistake reason: ${reason}`);
  }

  if (!VALID_STATUS.includes(status)) {
    throw new Error(`Invalid mistake status: ${status}`);
  }

  const safeConfidence = Math.min(
    1,
    Math.max(0, Number(confidence))
  );

  return Object.freeze({
    id: String(id),
    studentId: studentId === null ? null : String(studentId),
    attemptId: String(attemptId),
    questionId: String(questionId),

    reason,
    explanation: String(explanation),

    confidence: safeConfidence,
    status,

    practiceCount: Number(practiceCount),
    successfulAttempts: Number(successfulAttempts),

    createdAt: String(createdAt),
    lastPracticedAt:
      lastPracticedAt === null
        ? null
        : String(lastPracticedAt),

    nextReviewAt:
      nextReviewAt === null
        ? null
        : String(nextReviewAt),
  });
}

export { VALID_REASONS, VALID_STATUS };
