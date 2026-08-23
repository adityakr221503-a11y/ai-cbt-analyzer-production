/**
 * CBT Analyzer Pro
 * Production Core — Question Model
 *
 * v10.0.0 — Rank Booster / TOPPER
 */

export function createQuestion({

  // ==========================================
  // IDENTITY
  // ==========================================

  id,

  text,

  options = [],

  correctAnswer = null,


  // ==========================================
  // ACADEMIC METADATA
  // ==========================================

  subject = "",

  chapter = "",

  topic = "",

  concept = "",


  // ==========================================
  // DIFFICULTY
  // ==========================================

  difficulty = "medium",


  // ==========================================
  // MARKING
  // ==========================================

  marks = 4,

  negativeMarks = 1,


  // ==========================================
  // EXPLANATION
  // ==========================================

  explanation = "",


  // ==========================================
  // SOURCE
  // ==========================================

  source = "unknown",


  // ==========================================
  // RANK BOOSTER INTELLIGENCE
  // ==========================================

  skillTested = "",

  masterySkill = "",

  questionType = "standard",

  trapType = "",


  // ==========================================
  // QUESTION QUALITY
  // ==========================================

  learningObjective = "",

  examinerIntent = "",

  commonTrap = "",

  teachingPoint = "",


  // ==========================================
  // VARIATION / ADAPTIVE SYSTEM
  // ==========================================

  variationType = "original",

  variationOf = null,

  adaptive = false,

  targetMistakeId = null,


  // ==========================================
  // TEST-SERIES QUALITY
  // ==========================================

  qualityTier = "standard",

  uniquenessKey = "",

} = {}) {


  // ==========================================
  // VALIDATION
  // ==========================================

  if (!id) {

    throw new Error(
      "Question requires a unique id."
    );

  }


  if (
    !text ||
    !String(text).trim()
  ) {

    throw new Error(
      "Question requires text."
    );

  }


  // ==========================================
  // NORMALIZE OPTIONS
  // ==========================================

  const normalizedOptions =
    Array.isArray(options)
      ? [...options]
      : [];


  // ==========================================
  // RETURN IMMUTABLE QUESTION
  // ==========================================

  return Object.freeze({

    // ------------------------------------------
    // Identity
    // ------------------------------------------

    id:
      String(id),

    text:
      String(text),

    options:
      normalizedOptions,

    correctAnswer,


    // ------------------------------------------
    // Academic metadata
    // ------------------------------------------

    subject:
      String(subject),

    chapter:
      String(chapter),

    topic:
      String(topic),

    concept:
      String(concept),


    // ------------------------------------------
    // Difficulty
    // ------------------------------------------

    difficulty:
      String(difficulty),


    // ------------------------------------------
    // Marking
    // ------------------------------------------

    marks:
      Number(marks),

    negativeMarks:
      Number(negativeMarks),


    // ------------------------------------------
    // Explanation
    // ------------------------------------------

    explanation:
      String(explanation),


    // ------------------------------------------
    // Source
    // ------------------------------------------

    source:
      String(source),


    // ==========================================
    // RANK BOOSTER INTELLIGENCE
    // ==========================================

    skillTested:
      String(skillTested),

    masterySkill:
      String(masterySkill),

    questionType:
      String(questionType),

    trapType:
      String(trapType),


    // ==========================================
    // TEACHING / EXAMINER INTELLIGENCE
    // ==========================================

    learningObjective:
      String(learningObjective),

    examinerIntent:
      String(examinerIntent),

    commonTrap:
      String(commonTrap),

    teachingPoint:
      String(teachingPoint),


    // ==========================================
    // ADAPTIVE / VARIATION
    // ==========================================

    variationType:
      String(variationType),

    variationOf:
      variationOf === null
        ? null
        : String(variationOf),

    adaptive:
      Boolean(adaptive),

    targetMistakeId:
      targetMistakeId === null
        ? null
        : String(targetMistakeId),


    // ==========================================
    // PREMIUM TEST QUALITY
    // ==========================================

    qualityTier:
      String(qualityTier),

    uniquenessKey:
      String(uniquenessKey),

  });

}
