"use strict";

/*
=========================================================
 PCB NICHOD — SUBJECT AUTHORING ENGINE v1
=========================================================

Creates structured authoring drafts from NICHOD
concept/trap/shortcut evidence.

Physics / Chemistry / Biology have separate blueprints.

IMPORTANT:
Generated drafts are NOT automatically verified.
They must pass the review/verification workflow.
=========================================================
*/

(function () {

  const CANDIDATE_KEY =
    "pcbNichodUnseenCandidates";

  function read(key, fallback) {
    try {
      const x = JSON.parse(
        localStorage.getItem(key) || "null"
      );
      return x == null ? fallback : x;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }

  function clean(v) {
    return String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function subject(q) {
    return clean(q.subject).toLowerCase();
  }

  function text(q) {
    return clean(
      q.question ||
      q.originalQuestion ||
      q.text
    );
  }

  function concepts(q) {
    return Array.isArray(q.concepts)
      ? q.concepts.filter(Boolean)
      : [];
  }

  function traps(q) {
    return Array.isArray(q.traps)
      ? q.traps.filter(Boolean)
      : [];
  }

  /*
  =======================================================
  PHYSICS
  =======================================================
  */

  function physicsBlueprint(q) {

    const t = text(q).toLowerCase();

    let type =
      "conceptual-condition";

    if (
      /force|mass|acceleration|momentum|energy|work/
        .test(t)
    ) {
      type =
        "parameter-change";
    }

    if (
      /current|voltage|resistance|power|circuit/
        .test(t)
    ) {
      type =
        "circuit-condition";
    }

    if (
      /lens|mirror|focal|image|refraction/
        .test(t)
    ) {
      type =
        "optics-condition";
    }

    if (
      /charge|field|potential|capacitor/
        .test(t)
    ) {
      type =
        "electrostatics-condition";
    }

    return {
      subject: "Physics",
      format: "MCQ",
      authoringType: type,
      requiredElements: [
        "given-condition",
        "target-quantity",
        "four-distinct-options",
        "dimensionally-consistent-answer"
      ],
      checks: [
        "units",
        "sign",
        "limiting-case",
        "formula-selection",
        "single-correct-option"
      ]
    };
  }

  /*
  =======================================================
  CHEMISTRY
  =======================================================
  */

  function chemistryBlueprint(q) {

    const t = text(q).toLowerCase();

    let type =
      "concept-condition";

    if (
      /reaction|reagent|product|mechanism/
        .test(t)
    ) {
      type =
        "reaction-condition";
    }

    if (
      /equilibrium|kc|kp|le-chatelier/
        .test(t)
    ) {
      type =
        "equilibrium-condition";
    }

    if (
      /mole|mass|volume|concentration/
        .test(t)
    ) {
      type =
        "stoichiometry-condition";
    }

    if (
      /oxidation|reduction|oxidising|reducing/
        .test(t)
    ) {
      type =
        "redox-condition";
    }

    if (
      /periodic|ionisation|electronegativity|atomic/
        .test(t)
    ) {
      type =
        "periodic-trend";
    }

    return {
      subject: "Chemistry",
      format: "MCQ",
      authoringType: type,
      requiredElements: [
        "chemical-condition",
        "target-concept",
        "four-distinct-options",
        "single-correct-option"
      ],
      checks: [
        "reaction-balance",
        "chemical-consistency",
        "condition-consistency",
        "single-correct-option"
      ]
    };
  }

  /*
  =======================================================
  BIOLOGY
  =======================================================
  */

  function biologyBlueprint(q) {

    const t = text(q).toLowerCase();

    let type =
      "ncert-concept";

    if (
      /statement|incorrect|correct|true|false/
        .test(t)
    ) {
      type =
        "statement-trap";
    }

    if (
      /match|pair|relationship/
        .test(t)
    ) {
      type =
        "match-concept";
    }

    if (
      /sequence|order|step/
        .test(t)
    ) {
      type =
        "sequence-concept";
    }

    if (
      /gene|allele|inheritance|dna|rna|chromosome/
        .test(t)
    ) {
      type =
        "genetics-concept";
    }

    if (
      /cell|tissue|organ|hormone|enzyme/
        .test(t)
    ) {
      type =
        "structure-function";
    }

    return {
      subject: "Biology",
      format: "MCQ",
      authoringType: type,
      requiredElements: [
        "ncert-concept",
        "precise-wording",
        "four-distinct-options",
        "single-correct-option"
      ],
      checks: [
        "ncert-consistency",
        "statement-logic",
        "terminology",
        "single-correct-option"
      ]
    };
  }

  /*
  =======================================================
  COMMON AUTHORING PLAN
  =======================================================
  */

  function blueprint(q) {

    const s =
      subject(q);

    if (s === "physics")
      return physicsBlueprint(q);

    if (s === "chemistry")
      return chemistryBlueprint(q);

    if (s === "biology")
      return biologyBlueprint(q);

    return {
      subject:
        clean(q.subject) || "PCB",
      format: "MCQ",
      authoringType:
        "concept-condition",
      requiredElements: [
        "clear-question",
        "four-options",
        "single-correct-option"
      ],
      checks: [
        "single-correct-option"
      ]
    };
  }

  /*
  =======================================================
  BUILD AUTHORING DRAFT
  =======================================================
  */

  function createDraft(candidate) {

    if (!candidate)
      return null;

    const plan =
      blueprint(candidate);

    const draft = {

      id:
        "DRAFT-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 8),

      candidateId:
        candidate.id,

      source:
        "PCB NICHOD",

      unseen:
        true,

      verified:
        false,

      status:
        "AUTHORING_REQUIRED",

      subject:
        plan.subject,

      chapter:
        clean(candidate.chapter),

      topic:
        clean(candidate.topic),

      concepts:
        concepts(candidate),

      traps:
        traps(candidate),

      authoringType:
        plan.authoringType,

      authoringPlan:
        plan,

      sourceQuestion:
        text(candidate),

      sourceFamily:
        clean(
          candidate.generatedFromFamily
        ),

      variationStrategy:
        clean(
          candidate.variationStrategy
        ),

      /*
       * These are intentionally blank.
       * The review/authoring step fills them.
       */

      question: "",

      options: [
        "",
        "",
        "",
        ""
      ],

      answer: "",

      explanation: "",

      createdAt:
        new Date().toISOString()

    };

    return draft;
  }

  /*
  =======================================================
  CREATE DRAFTS
  =======================================================
  */

  function createDrafts(options = {}) {

    const list =
      read(
        CANDIDATE_KEY,
        []
      );

    if (!Array.isArray(list))
      return [];

    let pool =
      list.filter(
        q =>
          q &&
          q.status !==
            "VERIFIED"
      );

    if (options.subject) {

      pool =
        pool.filter(
          q =>
            subject(q) ===
            String(
              options.subject
            ).toLowerCase()
        );

    }

    const count =
      Math.max(
        1,
        Number(
          options.count || 10
        )
      );

    return pool
      .slice(0, count)
      .map(createDraft)
      .filter(Boolean);

  }

  /*
  =======================================================
  DRAFT QUALITY GATE
  =======================================================
  */

  function qualityGate(q) {

    const errors = [];

    const question =
      clean(q?.question);

    if (!question)
      errors.push(
        "missing-question"
      );

    if (
      !Array.isArray(q?.options) ||
      q.options.length !== 4
    ) {
      errors.push(
        "exactly-four-options-required"
      );
    }

    if (
      Array.isArray(q?.options)
    ) {

      const opts =
        q.options
          .map(clean);

      if (
        opts.some(
          x => !x
        )
      )
        errors.push(
          "empty-option"
        );

      const unique =
        new Set(
          opts.map(
            x =>
              x.toLowerCase()
          )
        );

      if (
        unique.size !== 4
      )
        errors.push(
          "duplicate-options"
        );

    }

    const answer =
      clean(
        q?.answer
      ).toLowerCase();

    if (
      !["a","b","c","d"]
        .includes(answer)
    )
      errors.push(
        "answer-must-be-a-b-c-or-d"
      );

    if (
      !clean(
        q?.explanation
      )
    )
      errors.push(
        "missing-explanation"
      );

    /*
     * Automatic verification is prohibited.
     */

    if (
      q?.verified === true
    )
      errors.push(
        "manual-verification-required"
      );

    return {
      valid:
        errors.length === 0,
      errors
    };

  }

  /*
  =======================================================
  SAVE AUTHORING DRAFT
  =======================================================
  */

  function saveDraft(draft) {

    if (!draft)
      return null;

    const drafts =
      read(
        "pcbNichodAuthoringDrafts",
        []
      );

    const list =
      Array.isArray(drafts)
        ? drafts
        : [];

    list.push(draft);

    write(
      "pcbNichodAuthoringDrafts",
      list
    );

    return draft;

  }

  /*
  =======================================================
  PUBLIC API
  =======================================================
  */

  window.PCBNICHODAuthoring = {

    blueprint,

    createDraft,

    createDrafts,

    qualityGate,

    saveDraft

  };

})();
