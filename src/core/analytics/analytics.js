/**
 * CBT Analyzer Pro
 * Production Core — Analytics Engine
 * v9.1.1
 */

export function calculateAttemptAnalytics({
  score = 0,
  correct = 0,
  incorrect = 0,
  skipped = 0,
  total = 0,
} = {}) {
  const attempted = Number(correct) + Number(incorrect);

  return {
    score: Number(score),
    correct: Number(correct),
    incorrect: Number(incorrect),
    skipped: Number(skipped),
    attempted,
    total: Number(total),

    accuracy:
      attempted > 0
        ? Number(((Number(correct) / attempted) * 100).toFixed(2))
        : 0,

    completionRate:
      Number(total) > 0
        ? Number(((attempted / Number(total)) * 100).toFixed(2))
        : 0,
  };
}

export function calculateMistakeAnalytics(mistakes = []) {
  if (!Array.isArray(mistakes)) {
    throw new Error("Mistakes must be an array.");
  }

  const byReason = {};

  for (const mistake of mistakes) {
    const reason = mistake.reason || "unknown";
    byReason[reason] = (byReason[reason] || 0) + 1;
  }

  const mastered = mistakes.filter(
    (mistake) => mistake.status === "mastered"
  ).length;

  const improving = mistakes.filter(
    (mistake) => mistake.status === "improving"
  ).length;

  return {
    total: mistakes.length,
    mastered,
    improving,
    active: mistakes.length - mastered,
    byReason,
  };
}

export function calculateImprovement(
  previousAccuracy = 0,
  currentAccuracy = 0
) {
  const previous = Number(previousAccuracy);
  const current = Number(currentAccuracy);

  return {
    previousAccuracy: previous,
    currentAccuracy: current,
    change: Number((current - previous).toFixed(2)),
    improved: current > previous,
  };
}
