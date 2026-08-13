/**
 * CBT Analyzer Pro
 * Production Core — CBT Engine
 * v9.1.1
 */

import { createAttempt } from "../models/attempt.js";
import { scoreAttempt } from "../scoring/scoring.js";
import { addItem } from "../storage/storage.js";
import { createMistakesFromAttempt } from "../mistakes/mistakeEngine.js";

export function startAttempt({
  id,
  testId,
  studentId = null,
}) {
  return createAttempt({
    id,
    testId,
    studentId,
    answers: {},
    status: "in-progress",
  });
}

export function saveAnswer(attempt, questionId, answer) {
  if (attempt.status !== "in-progress") {
    throw new Error("Cannot answer a submitted attempt.");
  }

  return {
    ...attempt,
    answers: {
      ...attempt.answers,
      [String(questionId)]: answer,
    },
  };
}

export function submitAttempt({
  attempt,
  questions,
  studentId = null,
  correctMarks = 4,
  negativeMarks = 1,
}) {
  if (!attempt) {
    throw new Error("Attempt is required.");
  }

  if (attempt.status !== "in-progress") {
    throw new Error("Attempt has already been submitted.");
  }

  const result = scoreAttempt({
    questions,
    answers: attempt.answers,
    correctMarks,
    negativeMarks,
  });

  const completedAttempt = {
    ...attempt,
    studentId:
      studentId ?? attempt.studentId ?? null,
    status: "completed",
    submittedAt: new Date().toISOString(),
    score: result.score,
    correct: result.correct,
    incorrect: result.incorrect,
    skipped: result.skipped,
  };

  addItem("attempts", completedAttempt);

  const mistakes = createMistakesFromAttempt({
    attemptId: completedAttempt.id,
    studentId: completedAttempt.studentId,
    questionResults: result.questionResults,
  });

  return {
    attempt: completedAttempt,
    score: result,
    mistakes,
  };
}
