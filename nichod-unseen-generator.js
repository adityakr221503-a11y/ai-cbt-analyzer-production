"use strict";

/*
=========================================================
 PCB NICHOD — UNSEEN CANDIDATE GENERATOR
 v1
=========================================================

Purpose:
  Existing verified/source questions से structurally
  different unseen CANDIDATES बनाना.

Important:
  - Fake answers invent नहीं करता.
  - Existing answer को blindly बदलकर valid नहीं मानता.
  - Generated candidates "verified" नहीं होते.
  - Final verification flag false रहता है.
  - Original PYQ हमेशा preserved रहता है.

Candidate strategies:
  Physics   → quantity/condition/parameter variation
  Chemistry → condition/reagent/concept variation
  Biology   → statement/context/relationship variation

=========================================================
*/

(function () {

  const CORPUS_KEY =
    "pcbNichodCorpus";

  const UNSEEN_KEY =
    "pcbNichodUnseenCandidates";

  function clean(v) {
    return String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readJSON(key, fallback) {

    try {

      const raw =
        localStorage.getItem(key);

      if (!raw)
        return fallback;

      const value =
        JSON.parse(raw);

      return value;

    } catch (_) {

      return fallback;

    }

  }

  function corpus() {

    const data =
      readJSON(
        CORPUS_KEY,
        []
      );

    return Array.isArray(data)
      ? data
      : [];

  }

  function questionText(q) {

    return clean(
      q.question ||
      q.text ||
      q.prompt ||
      ""
    );

  }

  function key(q) {

    return clean(
      q.id ||
      q.nichodId ||
      q.question
    ).toLowerCase();

  }

  function subject(q) {

    return clean(
      q.subject ||
      ""
    );

  }

  function family(q) {

    return clean(
      q.pyqFamily ||
      q.topic ||
      q.chapter ||
      q.concepts?.[0] ||
      "general"
    );

  }

  function cloneOptions(q) {

    return Array.isArray(q.options)
      ? q.options.map(clean)
      : [];

  }

  /*
  -------------------------------------------------------
  Physics blueprint
  -------------------------------------------------------
  */

  function physicsBlueprint(q) {

    const text =
      questionText(q);

    const changes = [];

    if (
      /mass|weight|force|acceleration/i
        .test(text)
    )
      changes.push(
        "vary-primary-mechanical-parameter"
      );

    if (
      /velocity|speed|time|distance|displacement/i
        .test(text)
    )
      changes.push(
        "vary-motion-condition"
      );

    if (
      /resistance|current|voltage|power/i
        .test(text)
    )
      changes.push(
        "vary-electrical-parameter"
      );

    if (
      /lens|mirror|focal|image/i
        .test(text)
    )
      changes.push(
        "vary-optical-condition"
      );

    if (
      /charge|field|potential|capacitor/i
        .test(text)
    )
      changes.push(
        "vary-electrostatic-condition"
      );

    if (!changes.length)
      changes.push(
        "change-given-condition"
      );

    return changes[0];
  }

  /*
  -------------------------------------------------------
  Chemistry blueprint
  -------------------------------------------------------
  */

  function chemistryBlueprint(q) {

    const text =
      questionText(q);

    if (
      /reagent|product|reaction|mechanism/i
        .test(text)
    )
      return "change-reaction-condition";

    if (
      /oxidation|reduction|oxidising|reducing/i
        .test(text)
    )
      return "reverse-redox-context";

    if (
      /equilibrium|kc|kp|le-chatelier/i
        .test(text)
    )
      return "change-equilibrium-condition";

    if (
      /mole|mass|volume|concentration/i
        .test(text)
    )
      return "change-quantity-condition";

    if (
      /periodic|atomic|ionisation|electronegativity/i
        .test(text)
    )
      return "change-comparison-direction";

    return "change-chemical-condition";
  }

  /*
  -------------------------------------------------------
  Biology blueprint
  -------------------------------------------------------
  */

  function biologyBlueprint(q) {

    const text =
      questionText(q);

    if (
      /statement|statements|incorrect|correct|true|false/i
        .test(text)
    )
      return "statement-reconstruction";

    if (
      /match|matching|pair|pairs/i
        .test(text)
    )
      return "relationship-reconstruction";

    if (
      /sequence|order|step|steps/i
        .test(text)
    )
      return "sequence-variation";

    if (
      /organ|hormone|enzyme|cell|tissue/i
        .test(text)
    )
      return "structure-function-variation";

    if (
      /gene|allele|cross|inheritance|dna|rna/i
        .test(text)
    )
      return "genetics-context-variation";

    return "statement-context-variation";
  }

  function blueprint(q) {

    const s =
      subject(q).toLowerCase();

    if (s === "physics")
      return physicsBlueprint(q);

    if (s === "chemistry")
      return chemistryBlueprint(q);

    if (s === "biology")
      return biologyBlueprint(q);

    return "context-variation";
  }

  /*
  -------------------------------------------------------
  Generate candidate shell
  -------------------------------------------------------
  */

  function generateCandidate(q) {

    const original =
      questionText(q);

    if (!original)
      return null;

    const strategy =
      blueprint(q);

    /*
     * We deliberately create a REVIEW candidate,
     * not a fake solved question.
     *
     * The original concept/question is preserved and
     * the required variation is recorded explicitly.
     */

    const candidate = {

      id:
        "UNSEEN-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 8),

      source:
        "PCB NICHOD",

      generatedFrom:
        key(q),

      generatedFromFamily:
        family(q),

      subject:
        subject(q),

      chapter:
        clean(q.chapter),

      topic:
        clean(q.topic),

      concepts:
        Array.isArray(q.concepts)
          ? q.concepts.slice()
          : [],

      traps:
        Array.isArray(q.traps)
          ? q.traps.slice()
          : [],

      shortcuts:
        Array.isArray(q.shortcuts)
          ? q.shortcuts.slice()
          : [],

      variationStrategy:
        strategy,

      originalQuestion:
        original,

      /*
       * These remain empty until an actual
       * validated question is produced.
       */

      question:
        "",

      options:
        [],

      answer:
        "",

      explanation:
        "",

      verified:
        false,

      unseen:
        true,

      diamond:
        false,

      status:
        "REVIEW_REQUIRED",

      createdAt:
        new Date().toISOString()

    };

    return candidate;
  }

  /*
  -------------------------------------------------------
  Candidate validation
  -------------------------------------------------------
  */

  function validateCandidate(candidate, all) {

    const errors = [];

    if (!candidate)
      return {
        valid: false,
        errors: [
          "empty-candidate"
        ]
      };

    if (
      !candidate.generatedFrom
    )
      errors.push(
        "missing-source"
      );

    if (
      !candidate.variationStrategy
    )
      errors.push(
        "missing-variation-strategy"
      );

    /*
     * Do not allow an empty candidate to enter
     * the actual Ranker question pool.
     */

    if (
      !candidate.question
    )
      errors.push(
        "question-not-authored"
      );

    if (
      !Array.isArray(
        candidate.options
      ) ||
      candidate.options.length < 2
    )
      errors.push(
        "options-not-validated"
      );

    /*
     * Duplicate protection.
     */

    const candidateText =
      clean(
        candidate.question
      ).toLowerCase();

    if (candidateText) {

      const duplicate =
        all.some(q =>
          clean(
            q.question ||
            q.text ||
            ""
          ).toLowerCase() ===
          candidateText
        );

      if (duplicate)
        errors.push(
          "duplicate-question"
        );
    }

    return {
      valid:
        errors.length === 0,
      errors
    };
  }

  /*
  -------------------------------------------------------
  Store candidates separately
  -------------------------------------------------------
  */

  function saveCandidate(candidate) {

    const old =
      readJSON(
        UNSEEN_KEY,
        []
      );

    const list =
      Array.isArray(old)
        ? old
        : [];

    const existing =
      list.find(
        x =>
          x.generatedFrom ===
          candidate.generatedFrom &&
          x.variationStrategy ===
          candidate.variationStrategy
      );

    if (!existing)
      list.push(candidate);

    localStorage.setItem(
      UNSEEN_KEY,
      JSON.stringify(list)
    );

    return list;
  }

  /*
  -------------------------------------------------------
  Generate from one question
  -------------------------------------------------------
  */

  function generateFromQuestion(q) {

    const candidate =
      generateCandidate(q);

    if (!candidate)
      return null;

    saveCandidate(
      candidate
    );

    return candidate;
  }

  /*
  -------------------------------------------------------
  Generate candidate set
  -------------------------------------------------------
  */

  function generate(options = {}) {

    const data =
      corpus();

    if (!data.length)
      return {
        generated: [],
        count: 0
      };

    const count =
      Math.max(
        1,
        Number(
          options.count || 10
        )
      );

    let pool =
      data.filter(q => {

        if (
          options.subject &&
          subject(q) !==
          options.subject
        )
          return false;

        if (
          options.requireVerified &&
          q.verified !== true
        )
          return false;

        /*
         * Original unseen records are not used
         * as a source repeatedly.
         */

        if (
          q.unseen === true
        )
          return false;

        return true;
      });

    /*
     * Prefer Diamond-rich source material.
     */

    pool.sort(
      (a,b) =>
        Number(
          b.diamond === true
        ) -
        Number(
          a.diamond === true
        )
    );

    const generated = [];

    for (
      const q of pool
    ) {

      if (
        generated.length >=
        count
      )
        break;

      const candidate =
        generateCandidate(q);

      if (!candidate)
        continue;

      saveCandidate(
        candidate
      );

      generated.push(
        candidate
      );
    }

    return {
      generated,
      count:
        generated.length
    };
  }

  /*
  -------------------------------------------------------
  Promote ONLY externally validated candidates
  -------------------------------------------------------
  */

  function promote(candidateId, data) {

    const list =
      readJSON(
        UNSEEN_KEY,
        []
      );

    if (!Array.isArray(list))
      return {
        ok: false,
        reason:
          "candidate-store-invalid"
      };

    const index =
      list.findIndex(
        x =>
          x.id === candidateId
      );

    if (index < 0)
      return {
        ok: false,
        reason:
          "candidate-not-found"
      };

    const candidate =
      list[index];

    const updated = {
      ...candidate,

      question:
        clean(
          data.question
        ),

      options:
        Array.isArray(
          data.options
        )
          ? data.options
          : [],

      answer:
        clean(
          data.answer
        ),

      explanation:
        clean(
          data.explanation
        ),

      verified:
        data.verified === true,

      status:
        data.verified === true
          ? "VERIFIED"
          : "REVIEW_REQUIRED",

      diamond:
        data.verified === true &&
        data.diamond === true,

      promotedAt:
        new Date().toISOString()
    };

    const validation =
      validateCandidate(
        updated,
        corpus()
      );

    if (!validation.valid)
      return {
        ok: false,
        errors:
          validation.errors
      };

    list[index] =
      updated;

    localStorage.setItem(
      UNSEEN_KEY,
      JSON.stringify(list)
    );

    return {
      ok: true,
      candidate:
        updated
    };
  }

  /*
  -------------------------------------------------------
  Export verified unseen questions to Ranker
  -------------------------------------------------------
  */

  function getVerifiedUnseen() {

    const list =
      readJSON(
        UNSEEN_KEY,
        []
      );

    if (!Array.isArray(list))
      return [];

    return list.filter(
      q =>
        q.unseen === true &&
        q.verified === true &&
        q.question &&
        Array.isArray(
          q.options
        ) &&
        q.options.length >= 2
    );
  }

  function addToRanker(
    options = {}
  ) {

    const existing =
      getVerifiedUnseen();

    const count =
      Math.max(
        1,
        Number(
          options.count || 45
        )
      );

    const selected =
      existing
        .sort(
          () =>
            Math.random() - 0.5
        )
        .slice(
          0,
          count
        );

    if (!selected.length)
      return {
        ok: false,
        count: 0,
        reason:
          "No verified unseen questions"
      };

    localStorage.setItem(
      "rbSelectedQuestions",
      JSON.stringify(
        selected
      )
    );

    localStorage.setItem(
      "CBT_ACTIVE_SOURCE",
      "PCB NICHOD Unseen Ranker"
    );

    localStorage.setItem(
      "PCB_NICHOD_ACTIVE_UNSEEN_TEST",
      JSON.stringify({
        source:
          "PCB NICHOD Unseen Ranker",
        createdAt:
          new Date().toISOString(),
        count:
          selected.length,
        questions:
          selected
      })
    );

    return {
      ok: true,
      count:
        selected.length,
      questions:
        selected
    };
  }

  window.PCBNICHODUnseen = {

    corpus,

    blueprint,

    generateCandidate,

    generate,

    validateCandidate,

    generateFromQuestion,

    promote,

    getVerifiedUnseen,

    addToRanker

  };

})();
