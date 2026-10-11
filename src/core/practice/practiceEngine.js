/**
 * CBT Analyzer Pro
 * Production Core — Practice Engine
 * v9.1.1
 */

import { getItem, addItem } from "../storage/storage.js";
import { recordPracticeResult } from "../mistakes/mistakeEngine.js";
import { getDPPStage } from "../dppEngine.js";

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
  practiceType,
  timeSpent = 0,
} = {}) {
  const mistake = getMistakeForPractice(mistakeId);

  const updatedMistake = recordPracticeResult(
    mistake,
    Boolean(successful),
    { practiceType, timeSpent: Number(timeSpent) || 0 }
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

/* Next stage of the Deliberate Practice ladder for a mistake:
   familiar -> novel -> transfer -> mastered (single source: dppEngine). */
export function getNextPracticeType(mistake) {
  return getDPPStage(mistake);
}
