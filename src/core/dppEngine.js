/**
 * CBT Analyzer Pro
 * Production Core — Adaptive DPP Engine
 *
 * v10.0.0 — Rank Booster / TOPPER
 *
 * Purpose:
 * - Identify high-priority mistakes
 * - Decide which mistakes need DPP
 * - Build a structured DPP target
 * - Separate familiar, novel and transfer practice
 * - Decide when a student is ready for mastery checking
 */

import {
  getMistakeBook,
  getActiveMistakes,
} from "../mistakes/mistakeBook.js";


/* ==========================================
   CONFIGURATION
========================================== */

const DEFAULT_LIMIT = 10;

const MASTERY = {
  familiarAttempts: 5,
  familiarSuccessRate: 0.90,

  novelAttempts: 3,
  novelSuccessRate: 0.80,

  transferAttempts: 2,
  transferSuccessRate: 0.75,
};


/* ==========================================
   SAFE NUMBER
========================================== */

function number(value, fallback = 0) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}


/* ==========================================
   SUCCESS RATE
========================================== */

function successRate(
  successful = 0,
  attempts = 0
) {
  const a = number(attempts);

  if (a <= 0) {
    return 0;
  }

  return Number(
    (
      (number(successful) / a) *
      100
    ).toFixed(2)
  );
}


/* ==========================================
   MISTAKE PRIORITY
========================================== */

export function calculateDPPPriority(
  mistake = {}
) {

  let priority =
    number(mistake.priority, 5);


  /*
   * Conceptual failures receive
   * higher priority.
   */

  const reasonWeight = {

    concept_gap: 5,

    application_error: 5,

    forgotten_fact: 4,

    calculation_error: 4,

    misread_question: 3,

    guess: 3,

    time_pressure: 3,

    silly_mistake: 2,

    unknown: 1,

  };


  priority +=
    number(
      reasonWeight[mistake.reason],
      1
    );


  /*
   * Repeated failure increases urgency.
   */

  const practiceAttempts =
    number(
      mistake.practiceCount
    );

  const practiceSuccess =
    number(
      mistake.successfulAttempts
    );


  if (
    practiceAttempts > 0 &&
    practiceSuccess === 0
  ) {
    priority += 2;
  }


  /*
   * Failed novel questions are
   * especially important.
   */

  const novelAttempts =
    number(
      mistake.novelAttempts
    );

  const novelSuccesses =
    number(
      mistake.novelSuccesses
    );


  if (
    novelAttempts >= 1 &&
    novelSuccesses < novelAttempts
  ) {
    priority += 2;
  }


  /*
   * Transfer failure indicates that
   * the concept is not yet generalized.
   */

  const transferAttempts =
    number(
      mistake.transferAttempts
    );

  const transferSuccesses =
    number(
      mistake.transferSuccesses
    );


  if (
    transferAttempts >= 1 &&
    transferSuccesses < transferAttempts
  ) {
    priority += 2;
  }


  /*
   * Hard questions receive additional
   * attention.
   */

  if (
    [
      "hard",
      "very-hard",
      "topper"
    ].includes(
      String(mistake.difficulty)
    )
  ) {
    priority += 1;
  }


  return Math.min(
    10,
    Math.max(
      1,
      priority
    )
  );
}


/* ==========================================
   DETERMINE PRACTICE STAGE
========================================== */

export function getDPPStage(
  mistake = {}
) {

  const familiarAttempts =
    number(
      mistake.practiceCount
    );

  const familiarSuccesses =
    number(
      mistake.successfulAttempts
    );


  const novelAttempts =
    number(
      mistake.novelAttempts
    );

  const novelSuccesses =
    number(
      mistake.novelSuccesses
    );


  const transferAttempts =
    number(
      mistake.transferAttempts
    );

  const transferSuccesses =
    number(
      mistake.transferSuccesses
    );


  const familiarRate =
    successRate(
      familiarSuccesses,
      familiarAttempts
    );


  const novelRate =
    successRate(
      novelSuccesses,
      novelAttempts
    );


  const transferRate =
    successRate(
      transferSuccesses,
      transferAttempts
    );


  /*
   * Stage 1
   *
   * Student still needs basic
   * familiar reinforcement.
   */

  if (
    familiarAttempts <
    MASTERY.familiarAttempts ||
    familiarRate <
    MASTERY.familiarSuccessRate * 100
  ) {
    return "familiar";
  }


  /*
   * Stage 2
   *
   * Familiar questions are good,
   * but concept must survive a
   * changed question.
   */

  if (
    novelAttempts <
    MASTERY.novelAttempts ||
    novelRate <
    MASTERY.novelSuccessRate * 100
  ) {
    return "novel";
  }


  /*
   * Stage 3
   *
   * Test transfer/application.
   */

  if (
    transferAttempts <
    MASTERY.transferAttempts ||
    transferRate <
    MASTERY.transferSuccessRate * 100
  ) {
    return "transfer";
  }


  /*
   * All stages passed.
   */

  return "mastery-check";
}


/* ==========================================
   WHETHER DPP IS REQUIRED
========================================== */

export function needsMoreDPP(
  mistake = {}
) {

  if (
    mistake.status === "mastered"
  ) {
    return false;
  }


  const stage =
    getDPPStage(mistake);


  return stage !== "mastery-check";
}


/* ==========================================
   MASTERY CHECK
========================================== */

export function isReadyForMasteryCheck(
  mistake = {}
) {

  return (
    mistake.status !== "mastered" &&
    getDPPStage(mistake) ===
      "mastery-check"
  );
}


/* ==========================================
   BUILD DPP TARGET
========================================== */

export function createDPPTarget(
  mistake = {}
) {

  const stage =
    getDPPStage(mistake);


  const priority =
    calculateDPPPriority(
      mistake
    );


  return {

    mistakeId:
      String(mistake.id),

    questionId:
      String(mistake.questionId),

    subject:
      mistake.subject || "",

    chapter:
      mistake.chapter || "",

    topic:
      mistake.topic || "",

    concept:
      mistake.concept || "",

    skillTested:
      mistake.skillTested || "",

    masterySkill:
      mistake.masterySkill || "",

    reason:
      mistake.reason || "unknown",

    difficulty:
      mistake.difficulty || "medium",

    questionType:
      mistake.questionType ||
      "standard",

    trapType:
      mistake.trapType || "",

    priority,

    stage,

    dppTrigger:
      needsMoreDPP(mistake),

    recommendedCount:
      stage === "familiar"
        ? 5
        : stage === "novel"
          ? 3
          : stage === "transfer"
            ? 2
            : 1,

    variationRequired:
      stage !== "familiar",

    masteryCheck:
      stage === "mastery-check",

  };
}


/* ==========================================
   GET ALL DPP TARGETS
========================================== */

export function getDPPTargets({
  limit = DEFAULT_LIMIT,
  includeMastered = false,
} = {}) {

  const mistakes =
    includeMastered
      ? getMistakeBook()
      : getActiveMistakes();


  return mistakes

    .filter(
      (mistake) =>
        includeMastered ||
        needsMoreDPP(mistake)
    )

    .map(
      (mistake) =>
        createDPPTarget(
          mistake
        )
    )

    .sort(
      (a, b) =>
        b.priority -
        a.priority
    )

    .slice(
      0,
      Math.max(
        1,
        number(
          limit,
          DEFAULT_LIMIT
        )
      )
    );
}


/* ==========================================
   GET NEXT DPP TARGET
========================================== */

export function getNextDPPTarget() {

  const targets =
    getDPPTargets({
      limit: 1,
    });


  return targets.length > 0
    ? targets[0]
    : null;
}


/* ==========================================
   DPP SUMMARY
========================================== */

export function getDPPSummary() {

  const mistakes =
    getActiveMistakes();


  const targets =
    getDPPTargets({
      limit: mistakes.length || 1,
    });


  const summary = {

    totalActiveMistakes:
      mistakes.length,

    totalDPPRequired:
      targets.filter(
        (target) =>
          target.dppTrigger
      ).length,

    familiar:
      targets.filter(
        (target) =>
          target.stage === "familiar"
      ).length,

    novel:
      targets.filter(
        (target) =>
          target.stage === "novel"
      ).length,

    transfer:
      targets.filter(
        (target) =>
          target.stage === "transfer"
      ).length,

    masteryReady:
      targets.filter(
        (target) =>
          target.stage ===
          "mastery-check"
      ).length,

    highestPriority:
      targets.length > 0
        ? targets[0].priority
        : 0,

    next:
      targets.length > 0
        ? targets[0]
        : null,

  };


  return summary;
    }
