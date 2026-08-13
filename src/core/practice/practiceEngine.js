/**
 * CBT Analyzer Pro
 * Production Core — Practice Engine
 * v9.1.1
 */

import { getItem, addItem } from "../storage/storage.js";
import { recordPracticeResult } from "../mistakes/mistakeEngine.js";

export function getMistakeForPractice(mistakeId) {
  const mistake = getItem("mistakes", mistakeId);

  if (!mistake) {
    throw new Error("Mistake not found.");
  }

  return mistake;
}

export function recordPractice({
  mistakeId,
  successful,
} = {}) {
  const mistake = getMistakeForPractice(mistakeId);

  const updatedMistake = recordPracticeResult(
    mistake,
    Boolean(successful)
  );

  addItem("mistakes", updatedMistake);

  return updatedMistake;
}

export function getPracticeProgress(mistake) {
  const attempts = Number(mistake.practiceCount || 0);
  const successful = Number(
    mistake.successfulAttempts || 0
  );

  return {
    attempts,
    successful,
    successRate:
      attempts > 0
        ? Number(((successful / attempts) * 100).toFixed(2))
        : 0,
    status: mistake.status,
  };
}
