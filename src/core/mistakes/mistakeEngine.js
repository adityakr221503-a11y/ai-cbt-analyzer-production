/**
 * CBT Analyzer Pro
 * Production Core — Mistake Engine
 *
 * v10.0.0 — Rank Booster / TOPPER
 */

import { createMistake } from "../models/mistake.js";
import { addItem } from "../storage/storage.js";


/* ==========================================
   CREATE MISTAKES FROM ATTEMPT
========================================== */

export function createMistakesFromAttempt({
  attemptId,
  studentId = null,
  questionResults = [],
  questions = [],
  defaultReason = "unknown",
} = {}) {

  if (!attemptId) {
    throw new Error("attemptId is required.");
  }

  const mistakes = [];

  for (const result of questionResults) {

    if (result.status !== "incorrect") {
      continue;
    }

    const question =
      questions.find(
        (q) =>
          String(q.id) ===
          String(result.questionId)
      );


    const mistake =
      createMistake({

        id:
          `${attemptId}_${result.questionId}`,

        studentId,

        attemptId,

        questionId:
          result.questionId,

        reason:
          defaultReason,

        explanation:
          question?.explanation || "",

        confidence: 0,

        status: "new",

        /* ==============================
           QUESTION INTELLIGENCE
        ============================== */

        subject:
          question?.subject || "",

        chapter:
          question?.chapter || "",

        topic:
          question?.topic || "",

        concept:
          question?.concept || "",

        difficulty:
          question?.difficulty || "medium",

        source:
          question?.source || "unknown",

        /* ==============================
           TOPPER DIAGNOSTICS
        ============================== */

        skillTested:
          question?.skillTested || "",

        masterySkill:
          question?.masterySkill ||
          question?.skillTested ||
          "",

        questionType:
          question?.questionType ||
          "standard",

        trapType:
          question?.trapType || "",

        priority:
          calculateMistakePriority({
            question,
            reason: defaultReason,
          }),

        dppTrigger: true,

      });


    addItem(
      "mistakes",
      mistake
    );

    mistakes.push(mistake);
  }

  return mistakes;
}


/* ==========================================
   PRIORITY ENGINE
========================================== */

export function calculateMistakePriority({
  question = null,
  reason = "unknown",
} = {}) {

  let priority = 5;


  /* Root-cause weighting */

  const reasonWeights = {

    concept_gap: 4,

    application_error: 4,

    forgotten_fact: 3,

    misread_question: 3,

    calculation_error: 3,

    time_pressure: 2,

    silly_mistake: 2,

    guess: 3,

    unknown: 1,

  };


  priority +=
    Number(
      reasonWeights[reason] || 1
    );


  /* Harder questions matter more */

  if (
    question?.difficulty === "hard" ||
    question?.difficulty === "very-hard" ||
    question?.difficulty === "topper"
  ) {
    priority += 2;
  }


  /* Trap questions deserve attention */

  if (
    question?.trapType
  ) {
    priority += 1;
  }


  return Math.min(
    10,
    Math.max(1, priority)
  );
}


/* ==========================================
   UPDATE MISTAKE REASON
========================================== */

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

    priority:
      Math.min(
        10,
        Number(
          mistake.priority || 5
        ) +
        (
          reason === "concept_gap" ||
          reason === "application_error"
            ? 1
            : 0
        )
      ),

    dppTrigger: true,

  };
}


/* ==========================================
   RECORD PRACTICE RESULT
========================================== */

export function recordPracticeResult(
  mistake,
  successful
) {

  const practiceCount =
    Number(
      mistake.practiceCount || 0
    ) + 1;


  const successfulAttempts =
    Number(
      mistake.successfulAttempts || 0
    ) +
    (
      successful
        ? 1
        : 0
    );


  const successRate =
    successfulAttempts /
    practiceCount;


  let status =
    mistake.status;


  if (
    successRate >= 0.8 &&
    practiceCount >= 3
  ) {
    status = "improving";
  }


  /*
   * IMPORTANT:
   *
   * Familiar practice alone
   * does NOT create mastery.
   */

  if (
    successRate >= 0.9 &&
    practiceCount >= 5 &&
    Number(
      mistake.novelAttempts || 0
    ) >= 3 &&
    Number(
      mistake.novelSuccesses || 0
    ) >= 3 &&
    Number(
      mistake.transferAttempts || 0
    ) >= 2 &&
    Number(
      mistake.transferSuccesses || 0
    ) >= 2
  ) {

    status = "mastered";
  }


  if (
    !successful &&
    (
      status === "improving" ||
      status === "mastered"
    )
  ) {

    status = "practicing";
  }


  /*
   * Failed practice increases
   * priority again.
   */

  let priority =
    Number(
      mistake.priority || 5
    );


  if (!successful) {

    priority =
      Math.min(
        10,
        priority + 1
      );

  }


  return {

    ...mistake,

    practiceCount,

    successfulAttempts,

    status,

    priority,

    dppTrigger:
      status !== "mastered",

    lastPracticedAt:
      new Date().toISOString(),

  };
}
