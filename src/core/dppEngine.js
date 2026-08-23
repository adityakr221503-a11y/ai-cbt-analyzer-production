/**
 * CBT Analyzer Pro
 * Production Core — DPP / Rank Booster Engine
 *
 * v10.3.0
 *
 * DPP = Daily Practice / Diagnostic Practice
 *
 * Flow:
 * Mistake
 *   ↓
 * Priority
 *   ↓
 * DPP Target
 *   ↓
 * Familiar
 *   ↓
 * Novel
 *   ↓
 * Transfer
 *   ↓
 * Mastery
 */

import {
  readCollection,
  addItem,
} from "../storage/storage.js";


/* =====================================================
   CONFIGURATION
===================================================== */

const DPP_CONFIG = {

  maxDailyTargets: 10,

  highPriorityLimit: 5,

  recurrenceThreshold: 2,

  familiarTarget: 5,

  novelTarget: 3,

  transferTarget: 2,

};


/* =====================================================
   SAFE NUMBER
===================================================== */

function num(
  value,
  fallback = 0
) {

  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;

}


/* =====================================================
   GET MISTAKES
===================================================== */

function getMistakes() {

  const mistakes =
    readCollection(
      "mistakes"
    );


  return Array.isArray(mistakes)
    ? mistakes
    : [];
}


/* =====================================================
   PRIORITY
===================================================== */

export function calculateDPPPriority(
  mistake
) {

  if (!mistake) {
    return 0;
  }


  let priority =
    num(
      mistake.priority,
      5
    );


  /*
   * Repeated weakness.
   */

  priority += Math.min(
    3,
    num(
      mistake.recurrenceCount
    )
  );


  /*
   * Incorrect practice.
   */

  const practiceAttempts =
    num(
      mistake.practiceCount
    );

  const successfulAttempts =
    num(
      mistake.successfulAttempts
    );


  if (
    practiceAttempts > 0
  ) {

    const successRate =
      successfulAttempts /
      practiceAttempts;


    if (
      successRate < 0.60
    ) {

      priority += 2;

    } else if (
      successRate < 0.80
    ) {

      priority += 1;

    }

  }


  /*
   * Active mistakes are more important
   * than already improving weaknesses.
   */

  if (
    mistake.status ===
    "new"
  ) {

    priority += 2;

  }


  if (
    mistake.status ===
    "practicing"
  ) {

    priority += 1;

  }


  /*
   * DPP-triggered mistakes move up.
   */

  if (
    mistake.dppTrigger
  ) {

    priority += 2;

  }


  return Math.min(
    100,
    Math.max(
      0,
      priority
    )
  );
}


/* =====================================================
   DETERMINE PRACTICE STAGE
===================================================== */

export function getDPPStage(
  mistake
) {

  if (!mistake) {
    return "familiar";
  }


  const familiarAttempts =
    num(
      mistake.practiceCount
    );


  const novelAttempts =
    num(
      mistake.novelAttempts
    );


  const transferAttempts =
    num(
      mistake.transferAttempts
    );


  const familiarSuccess =
    familiarAttempts >=
      DPP_CONFIG.familiarTarget &&

    (
      num(
        mistake.successfulAttempts
      ) /
      familiarAttempts
    ) >= 0.90;


  const novelSuccess =
    novelAttempts >=
      DPP_CONFIG.novelTarget &&

    (
      num(
        mistake.novelSuccesses
      ) /
      novelAttempts
    ) >= 0.80;


  const transferSuccess =
    transferAttempts >=
      DPP_CONFIG.transferTarget &&

    (
      num(
        mistake.transferSuccesses
      ) /
      transferAttempts
    ) >= 0.75;


  if (
    !familiarSuccess
  ) {

    return "familiar";

  }


  if (
    !novelSuccess
  ) {

    return "novel";

  }


  if (
    !transferSuccess
  ) {

    return "transfer";

  }


  return "mastered";
}


/* =====================================================
   SHOULD CONTINUE DPP
===================================================== */

export function needsMoreDPP(
  mistake
) {

  if (!mistake) {
    return false;
  }


  if (
    mistake.status ===
    "mastered"
  ) {

    return false;

  }


  return (
    getDPPStage(
      mistake
    ) !==
    "mastered"
  );
}


/* =====================================================
   MASTERY CHECK
===================================================== */

export function isReadyForMasteryCheck(
  mistake
) {

  if (!mistake) {
    return false;
  }


  const stage =
    getDPPStage(
      mistake
    );


  return (
    stage ===
    "mastered"
  );
}


/* =====================================================
   CREATE DPP TARGET
===================================================== */

export function createDPPTarget(
  mistake
) {

  if (!mistake) {

    throw new Error(
      "Mistake is required."
    );

  }


  const stage =
    getDPPStage(
      mistake
    );


  if (
    stage ===
    "mastered"
  ) {

    return null;

  }


  const priority =
    calculateDPPPriority(
      mistake
    );


  return {

    id:
      `dpp_${mistake.id}`,

    mistakeId:
      String(mistake.id),

    questionId:
      String(mistake.questionId),

    studentId:
      mistake.studentId ?? null,

    attemptId:
      mistake.attemptId ?? null,


    subject:
      mistake.subject || "",

    chapter:
      mistake.chapter || "",

    topic:
      mistake.topic || "",

    concept:
      mistake.concept || "",

    masterySkill:
      mistake.masterySkill ||
      mistake.skillTested ||
      "",


    difficulty:
      mistake.difficulty ||
      "medium",


    reason:
      mistake.reason ||
      "unknown",


    stage,

    priority,


    recurrenceCount:
      num(
        mistake.recurrenceCount
      ),


    practiceCount:
      num(
        mistake.practiceCount
      ),


    status:
      mistake.status ||
      "new",


    createdAt:
      new Date().toISOString(),

  };
}


/* =====================================================
   GET ALL DPP TARGETS
===================================================== */

export function getDPPTargets({

  limit =
    DPP_CONFIG.maxDailyTargets,

  subject = null,

} = {}) {

  let mistakes =
    getMistakes();


  /*
   * Remove mastered mistakes.
   */

  mistakes =
    mistakes.filter(
      (mistake) =>
        mistake.status !==
        "mastered"
    );


  /*
   * Optional subject filter.
   */

  if (subject) {

    mistakes =
      mistakes.filter(
        (mistake) =>
          String(
            mistake.subject || ""
          ).toLowerCase() ===
          String(subject)
            .toLowerCase()
      );

  }


  /*
   * Only weaknesses requiring DPP.
   */

  mistakes =
    mistakes.filter(
      (mistake) =>
        needsMoreDPP(
          mistake
        )
    );


  /*
   * Highest priority first.
   */

  mistakes.sort(
    (a, b) => {

      return (
        calculateDPPPriority(b) -
        calculateDPPPriority(a)
      );

    }
  );


  /*
   * Convert into DPP targets.
   */

  const targets = [];


  for (
    const mistake
    of mistakes.slice(
      0,
      Math.max(
        1,
        Number(limit) ||
          DPP_CONFIG.maxDailyTargets
      )
    )
  ) {

    const target =
      createDPPTarget(
        mistake
      );


    if (target) {

      targets.push(
        target
      );

    }

  }


  return targets;
}


/* =====================================================
   GET NEXT DPP TARGET
===================================================== */

export function getNextDPPTarget() {

  const targets =
    getDPPTargets({
      limit: 1,
    });


  return targets.length > 0
    ? targets[0]
    : null;
}


/* =====================================================
   GET DPP SUMMARY
===================================================== */

export function getDPPSummary() {

  const mistakes =
    getMistakes();


  const active =
    mistakes.filter(
      (mistake) =>
        mistake.status !==
        "mastered"
    );


  const mastered =
    mistakes.filter(
      (mistake) =>
        mistake.status ===
        "mastered"
    );


  const dppRequired =
    active.filter(
      (mistake) =>
        needsMoreDPP(
          mistake
        )
    );


  const familiar =
    active.filter(
      (mistake) =>
        getDPPStage(
          mistake
        ) === "familiar"
    );


  const novel =
    active.filter(
      (mistake) =>
        getDPPStage(
          mistake
        ) === "novel"
    );


  const transfer =
    active.filter(
      (mistake) =>
        getDPPStage(
          mistake
        ) === "transfer"
    );


  return {

    totalMistakes:
      mistakes.length,

    activeMistakes:
      active.length,

    mastered:
      mastered.length,

    dppRequired:
      dppRequired.length,

    familiar:
      familiar.length,

    novel:
      novel.length,

    transfer:
      transfer.length,

    dailyTargetCount:
      Math.min(
        DPP_CONFIG.maxDailyTargets,
        dppRequired.length
      ),

  };
}
