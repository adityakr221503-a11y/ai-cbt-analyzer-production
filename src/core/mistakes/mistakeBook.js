/**
 * CBT Analyzer Pro
 * Production Core — Mistake Model
 *
 * v10.0.0 — Rank Booster / TOPPER
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

  // Question information
  subject = "",
  chapter = "",
  topic = "",
  concept = "",
  difficulty = "medium",
  source = "unknown",

  // Rank Booster intelligence
  skillTested = "",
  masterySkill = "",
  questionType = "standard",
  trapType = "",

  // Adaptive priority
  priority = 5,
  dppTrigger = false,

  // Novel-question performance
  novelAttempts = 0,
  novelSuccesses = 0,

  // Transfer/application performance
  transferAttempts = 0,
  transferSuccesses = 0,

  // Latest practice information
  lastResult = null,
  lastPracticeType = null,
  lastPracticeTime = 0,
  lastConfidence = null,

} = {}) {

  if (!id) {
    throw new Error("Mistake requires a unique id.");
  }

  if (!attemptId) {
    throw new Error("Mistake requires an attemptId.");
  }

  if (!questionId) {
    throw new Error("Mistake requires a questionId.");
  }

  if (!VALID_REASONS.includes(reason)) {
    throw new Error(
      `Invalid mistake reason: ${reason}`
    );
  }

  if (!VALID_STATUS.includes(status)) {
    throw new Error(
      `Invalid mistake status: ${status}`
    );
  }

  const safeConfidence = Math.min(
    1,
    Math.max(0, Number(confidence))
  );

  const safePriority = Math.min(
    10,
    Math.max(1, Number(priority))
  );

  return Object.freeze({

    // Identity
    id: String(id),

    studentId:
      studentId === null
        ? null
        : String(studentId),

    attemptId: String(attemptId),

    questionId: String(questionId),

    // Diagnosis
    reason,

    explanation: String(explanation),

    confidence: safeConfidence,

    status,

    // Question metadata
    subject: String(subject),

    chapter: String(chapter),

    topic: String(topic),

    concept: String(concept),

    difficulty: String(difficulty),

    source: String(source),

    // Skill intelligence
    skillTested: String(skillTested),

    masterySkill: String(masterySkill),

    questionType: String(questionType),

    trapType: String(trapType),

    // Adaptive priority
    priority: safePriority,

    dppTrigger: Boolean(dppTrigger),

    // Familiar practice
    practiceCount: Number(practiceCount),

    successfulAttempts:
      Number(successfulAttempts),

    // Novel performance
    novelAttempts: Number(novelAttempts),

    novelSuccesses: Number(novelSuccesses),

    // Transfer performance
    transferAttempts:
      Number(transferAttempts),

    transferSuccesses:
      Number(transferSuccesses),

    // Timeline
    createdAt: String(createdAt),

    lastPracticedAt:
      lastPracticedAt === null
        ? null
        : String(lastPracticedAt),

    nextReviewAt:
      nextReviewAt === null
        ? null
        : String(nextReviewAt),

    // Latest practice
    lastResult,

    lastPracticeType,

    lastPracticeTime:
      Number(lastPracticeTime),

    lastConfidence:
      lastConfidence === null
        ? null
        : Math.min(
            1,
            Math.max(
              0,
              Number(lastConfidence)
            )
          ),
  });
}

export {
  VALID_REASONS,
  VALID_STATUS,
};
