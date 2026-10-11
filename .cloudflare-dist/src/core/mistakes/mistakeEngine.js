/**
 * CBT Analyzer Pro
 * Production Core — Mistake Engine
 *
 * v10.1.0 — Rank Booster / TOPPER
 *
 * Responsibilities:
 * - Create diagnostic mistakes
 * - Preserve question intelligence
 * - Detect recurring weaknesses
 * - Increase priority for repeated failures
 * - Trigger DPP
 * - Track practice progression
 */

import {
  createMistake,
} from "../models/mistake.js";

import {
  addItem,
  getItem,
  readCollection,
} from "../storage/storage.js";


/* =====================================================
   PRIORITY WEIGHTS
===================================================== */

const REASON_WEIGHT = {

  concept_gap: 5,

  application_error: 5,

  forgotten_fact: 4,

  calculation_error: 4,

  guess: 3,

  misread_question: 3,

  time_pressure: 3,

  silly_mistake: 2,

  unknown: 1,

};


/* =====================================================
   SAFE NUMBER
===================================================== */

function safeNumber(
  value,
  fallback = 0
) {

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}


/* =====================================================
   FIND EXISTING WEAKNESS
===================================================== */

function findExistingWeakness({
  questionId,
  studentId = null,
  masterySkill = "",
  concept = "",
} = {}) {

  const mistakes =
    readCollection("mistakes");


  if (!Array.isArray(mistakes)) {
    return null;
  }


  /*
   * First priority:
   * same student + same question.
   */

  let existing =
    mistakes.find(
      (mistake) =>

        String(mistake.questionId) ===
        String(questionId)

        &&

        (
          studentId === null ||
          mistake.studentId === null ||
          String(mistake.studentId) ===
          String(studentId)
        )

        &&

        mistake.status !== "mastered"
    );


  if (existing) {
    return existing;
  }


  /*
   * Second priority:
   * same mastery skill + concept.
   *
   * This allows Rank Booster to recognize
   * repeated conceptual weakness even when
   * a different question exposes it.
   */

  if (
    masterySkill ||
    concept
  ) {

    existing =
      mistakes.find(
        (mistake) => {

          const sameSkill =
            masterySkill &&
            mistake.masterySkill &&
            String(
              mistake.masterySkill
            ) ===
            String(masterySkill);


          const sameConcept =
            concept &&
            mistake.concept &&
            String(
              mistake.concept
            ) ===
            String(concept);


          return (
            (
              sameSkill ||
              sameConcept
            )

            &&

            mistake.status !==
              "mastered"
          );

        }
      );

  }


  return existing || null;
}


/* =====================================================
   CALCULATE PRIORITY
===================================================== */

export function calculateMistakePriority({
  question = null,
  reason = "unknown",
  recurrenceCount = 0,
} = {}) {

  let priority = 5;


  priority +=
    safeNumber(
      REASON_WEIGHT[reason],
      1
    );


  /*
   * Hard questions deserve more attention.
   */

  if (
    [
      "hard",
      "very-hard",
      "topper",
    ].includes(
      String(
        question?.difficulty
      )
    )
  ) {

    priority += 2;

  }


  /*
   * Trap-based questions deserve
   * additional attention.
   */

  if (
    question?.trapType
  ) {

    priority += 1;

  }


  /*
   * Repeated weakness.
   */

  priority += Math.min(
    3,
    safeNumber(
      recurrenceCount
    )
  );


  return Math.min(
    10,
    Math.max(
      1,
      priority
    )
  );
}


/* =====================================================
   CREATE / UPDATE MISTAKES
===================================================== */

export function createMistakesFromAttempt({

  attemptId,

  studentId = null,

  questionResults = [],

  questions = [],

  defaultReason = "unknown",

} = {}) {

  if (!attemptId) {

    throw new Error(
      "attemptId is required."
    );

  }


  const mistakes = [];


  for (
    const result
    of questionResults
  ) {

    if (
      result.status !==
      "incorrect"
    ) {

      continue;

    }


    const question =
      questions.find(
        (q) =>
          String(q.id) ===
          String(result.questionId)
      );


    /*
     * Look for an existing
     * unresolved weakness.
     */

    const existing =
      findExistingWeakness({

        questionId:
          result.questionId,

        studentId,

        masterySkill:
          question?.masterySkill ||
          question?.skillTested ||
          "",

        concept:
          question?.concept ||
          "",

      });


    /* =================================================
       NEW WEAKNESS
    ================================================= */

    if (!existing) {

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
            question?.explanation ||
            "",

          confidence: 0,

          status: "new",

          subject:
            question?.subject ||
            "",

          chapter:
            question?.chapter ||
            "",

          topic:
            question?.topic ||
            "",

          concept:
            question?.concept ||
            "",

          difficulty:
            question?.difficulty ||
            "medium",

          source:
            question?.source ||
            "unknown",

          skillTested:
            question?.skillTested ||
            "",

          masterySkill:
            question?.masterySkill ||
            question?.skillTested ||
            "",

          questionType:
            question?.questionType ||
            "standard",

          trapType:
            question?.trapType ||
            "",

          priority:
            calculateMistakePriority({

              question,

              reason:
                defaultReason,

              recurrenceCount: 0,

            }),

          dppTrigger: true,

        });


      addItem(
        "mistakes",
        mistake
      );


      mistakes.push(
        mistake
      );


      continue;
    }


    /* =================================================
       RECURRING WEAKNESS
    ================================================= */

    const recurrenceCount =
      safeNumber(
        existing.recurrenceCount
      ) + 1;


    const priority =
      calculateMistakePriority({

        question,

        reason:
          existing.reason ||
          defaultReason,

        recurrenceCount,

      });


    const updatedMistake = {

      ...existing,

      /*
       * Keep the latest attempt.
       */

      attemptId:
        String(attemptId),


      /*
       * Count recurrence.
       */

      recurrenceCount,


      /*
       * Increase priority.
       */

      priority,


      /*
       * Re-trigger DPP.
       */

      dppTrigger: true,


      /*
       * Keep current status unless
       * it had already been mastered.
       */

      status:
        existing.status ===
        "mastered"

          ? "practicing"

          : existing.status,


      /*
       * Update latest question
       * metadata where available.
       */

      subject:
        question?.subject ||
        existing.subject ||
        "",

      chapter:
        question?.chapter ||
        existing.chapter ||
        "",

      topic:
        question?.topic ||
        existing.topic ||
        "",

      concept:
        question?.concept ||
        existing.concept ||
        "",

      skillTested:
        question?.skillTested ||
        existing.skillTested ||
        "",

      masterySkill:
        question?.masterySkill ||
        existing.masterySkill ||
        "",

      questionType:
        question?.questionType ||
        existing.questionType ||
        "standard",

      trapType:
        question?.trapType ||
        existing.trapType ||
        "",

    };


    addItem(
      "mistakes",
      updatedMistake
    );


    mistakes.push(
      updatedMistake
    );

  }


  return mistakes;
}


/* =====================================================
   UPDATE MISTAKE REASON
===================================================== */

export function updateMistakeReason(
  mistake,
  reason,
  explanation = ""
) {

  if (!mistake) {

    throw new Error(
      "Mistake is required."
    );

  }


  if (!reason) {

    throw new Error(
      "Mistake reason is required."
    );

  }


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
        safeNumber(
          mistake.priority,
          5
        ) +

        (
          reason ===
            "concept_gap" ||

          reason ===
            "application_error"

            ? 1
            : 0
        )
      ),

    dppTrigger: true,

  };
}


/* =====================================================
   RECORD PRACTICE RESULT
===================================================== */

export function recordPracticeResult(
  mistake,
  successful,
  options = {}
) {

  if (!mistake) {

    throw new Error(
      "Mistake is required."
    );

  }


  const isSuccessful =
    Boolean(successful);


  const practiceCount =
    safeNumber(
      mistake.practiceCount
    ) + 1;


  const successfulAttempts =
    safeNumber(
      mistake.successfulAttempts
    ) +

    (
      isSuccessful
        ? 1
        : 0
    );


  const successRate =
    practiceCount > 0
      ? successfulAttempts /
        practiceCount
      : 0;


  let status =
    mistake.status ||
    "new";


  /*
   * Familiar practice improvement.
   */

  if (
    successRate >= 0.8 &&
    practiceCount >= 3
  ) {

    status =
      "improving";

  }


  /*
   * Failed practice should never
   * silently remain mastered.
   */

  if (
    !isSuccessful &&
    (
      status === "improving" ||
      status === "mastered"
    )
  ) {

    status =
      "practicing";

  }


  /*
   * Novel practice tracking.
   */

  let novelAttempts =
    safeNumber(
      mistake.novelAttempts
    );

  let novelSuccesses =
    safeNumber(
      mistake.novelSuccesses
    );


  if (
    options.practiceType ===
    "novel"
  ) {

    novelAttempts++;

    if (isSuccessful) {
      novelSuccesses++;
    }

  }


  /*
   * Transfer practice tracking.
   */

  let transferAttempts =
    safeNumber(
      mistake.transferAttempts
    );

  let transferSuccesses =
    safeNumber(
      mistake.transferSuccesses
    );


  if (
    options.practiceType ===
    "transfer"
  ) {

    transferAttempts++;

    if (isSuccessful) {
      transferSuccesses++;
    }

  }


  /*
   * Mastery is intentionally difficult.
   *
   * Familiar + novel + transfer
   * must all demonstrate competence.
   */

  const familiarReady =
    practiceCount >= 5 &&
    successRate >= 0.90;


  const novelReady =
    novelAttempts >= 3 &&
    (
      novelSuccesses /
      novelAttempts
    ) >= 0.80;


  const transferReady =
    transferAttempts >= 2 &&
    (
      transferSuccesses /
      transferAttempts
    ) >= 0.75;


  if (
    familiarReady &&
    novelReady &&
    transferReady
  ) {

    status =
      "mastered";

  }


  /*
   * Failed mastery test reopens
   * the weakness.
   */

  const dppTrigger =
    status !== "mastered";


  let priority =
    safeNumber(
      mistake.priority,
      5
    );


  if (!isSuccessful) {

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

    novelAttempts,

    novelSuccesses,

    transferAttempts,

    transferSuccesses,

    status,

    priority,

    dppTrigger,

    lastResult:
      isSuccessful
        ? "correct"
        : "incorrect",

    lastPracticeType:
      options.practiceType ||
      "familiar",

    lastPracticeTime:
      safeNumber(
        options.timeSpent,
        0
      ),

    lastConfidence:
      options.confidence === undefined
        ? mistake.lastConfidence ?? null
        : Math.min(
            1,
            Math.max(
              0,
              safeNumber(
                options.confidence
              )
            )
          ),

    lastPracticedAt:
      new Date().toISOString(),

  };
}
