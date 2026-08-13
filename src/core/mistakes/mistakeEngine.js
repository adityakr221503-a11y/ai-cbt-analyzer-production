/**
 * CBT Analyzer Pro
 * Production Core — Mistake Engine
 *
 * v9.1.1
 */

import { createMistake } from "../models/mistake.js";
import { addItem } from "../storage/storage.js";

export function createMistakesFromAttempt({
  attemptId,
  studentId = null,
  questionResults = [],
  defaultReason = "unknown",
} = {}) {
  if (!attemptId) {
    throw new Error("attemptId is required.");
  }

  const mistakes = [];

  for (const result of questionResults) {
    if (result.status !== "incorrect") continue;

    const mistake = createMistake({
      id: `${attemptId}_${result.questionId}`,
      studentId,
      attemptId,
      questionId: result.questionId,
      reason: defaultReason,
      explanation: "",
      confidence: 0,
      status: "new",
    });

    addItem("mistakes", mistake);
    mistakes.push(mistake);
  }

  return mistakes;
}

export function updateMistakeReason(
  mistake,
  reason,
  explanation = ""
) {
  return {
    ...mistake,
    reason,
    explanation,
    status:
      mistake.status === "new"
        ? "learning"
        : mistake.status,
  };
}

export function recordPracticeResult(
  mistake,
  successful
) {
  const practiceCount =
    Number(mistake.practiceCount || 0) + 1;

  const successfulAttempts =
    Number(mistake.successfulAttempts || 0) +
    (successful ? 1 : 0);

  const successRate =
    successfulAttempts / practiceCount;

  let status = mistake.status;

  if (successRate >= 0.8 && practiceCount >= 3) {
    status = "improving";
  }

  if (successRate >= 0.9 && practiceCount >= 5) {
    status = "mastered";
  }

  if (!successful && status === "improving") {
    status = "practicing";
  }

  return {
    ...mistake,
    practiceCount,
    successfulAttempts,
    status,
    lastPracticedAt: new Date().toISOString(),
  };
}
