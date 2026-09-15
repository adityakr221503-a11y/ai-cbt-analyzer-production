"use strict";

/*
=========================================================
 PCB NICHOD — UNIFIED ORCHESTRATOR V1
=========================================================

 PDF
  ↓
 NICHOD parsing / metadata
  ↓
PYQ + verified + unseen
  ↓
Ranker selection
  ↓
CBT
  ↓
Result
  ↓
Mistake Bank
  ↓
Concept / Trap / Shortcut evidence
  ↓
Adaptive Mentor
  ↓
Next targeted test
  ↓
Retry / Mastery

Subjects:
  PHYSICS
  CHEMISTRY
  BIOLOGY
=========================================================
*/

(function () {

  const PLAN_KEY =
    "pcbNichodAdaptivePlan";

  const EVIDENCE_KEY =
    "pcbNichodMentorEvidence";

  const HISTORY_KEY =
    "cbtHistory";

  const SUBJECTS = {
    Physics: {
      focus: [
        "concept",
        "formula",
        "application",
        "calculation",
        "units",
        "graph",
        "approximation",
        "trap"
      ]
    },

    Chemistry: {
      focus: [
        "NCERT",
        "reaction",
        "mechanism",
        "exception",
        "calculation",
        "concept",
        "inorganic_fact",
        "organic_trap"
      ]
    },

    Biology: {
      focus: [
        "NCERT",
        "line_detail",
        "statement",
        "exception",
        "diagram",
        "terminology",
        "match",
        "trap"
      ]
    }
  };

  function read(key, fallback) {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(key) || "null"
        );

      return value == null
        ? fallback
        : value;

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

  function clean(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function subjectOf(q) {

    const raw =
      clean(
        q?.subject ||
        q?.section ||
        q?.stream
      ).toLowerCase();

    if (
      raw.includes("bio")
    )
      return "Biology";

    if (
      raw.includes("chem")
    )
      return "Chemistry";

    if (
      raw.includes("phys")
    )
      return "Physics";

    return "Other";
  }

  function getEvidence() {

    const data =
      read(
        EVIDENCE_KEY,
        null
      );

    return data || {
      attempts: 0,
      correct: 0,
      wrong: 0,
      concepts: {},
      traps: {},
      topics: {},
      chapters: {},
      subjects: {}
    };
  }

  function weaknessMap() {

    const evidence =
      getEvidence();

    const output = [];

    function collect(
      source,
      type
    ) {

      Object.entries(
        source || {}
      ).forEach(
        ([name, value]) => {

          const attempts =
            Number(
              value?.attempts || 0
            );

          const wrong =
            Number(
              value?.wrong || 0
            );

          if (!attempts)
            return;

          const accuracy =
            (
              (
                attempts - wrong
              ) /
              attempts
            ) * 100;

          output.push({
            type,
            name,
            attempts,
            wrong,
            accuracy
          });

        }
      );

    }

    collect(
      evidence.concepts,
      "concept"
    );

    collect(
      evidence.traps,
      "trap"
    );

    collect(
      evidence.topics,
      "topic"
    );

    collect(
      evidence.chapters,
      "chapter"
    );

    return output
      .sort(
        (a, b) =>
          b.wrong - a.wrong ||
          a.accuracy - b.accuracy
      );

  }

  function buildPlan() {

    const weaknesses =
      weaknessMap();

    const plan = {
      version: 1,
      createdAt:
        new Date().toISOString(),

      subjects: {},

      priorities:
        weaknesses.slice(0, 20),

      rules: {
        noBlindRepetition: true,
        prioritizeWeakness: true,
        preserveMastery: true,
        includeNewConcepts: true,
        retryRealMistakes: true
      }
    };

    [
      "Physics",
      "Chemistry",
      "Biology"
    ].forEach(
      subject => {

        const subjectWeak =
          weaknesses.filter(
            x => {

              const e =
                getEvidence();

              return (
                e.subjects &&
                e.subjects[subject]
              );

            }
          );

        plan.subjects[subject] = {

          focus:
            SUBJECTS[subject].focus,

          targets:
            subjectWeak
              .slice(0, 8),

          mode:
            subjectWeak.length
              ? "recovery"
              : "coverage"

        };

      }
    );

    write(
      PLAN_KEY,
      plan
    );

    return plan;

  }

  function getPlan() {

    return read(
      PLAN_KEY,
      null
    ) || buildPlan();

  }

  function selectQuestionScore(q) {

    const plan =
      getPlan();

    const subject =
      subjectOf(q);

    let score = 0;

    const chapter =
      clean(q?.chapter);

    const topic =
      clean(q?.topic);

    const concept =
      clean(
        q?.concept ||
        q?.conceptTag
      );

    const trap =
      clean(
        q?.trap ||
        q?.trapTag
      );

    const targets =
      plan.subjects?.[subject]
        ?.targets || [];

    targets.forEach(
      target => {

        if (
          concept &&
          target.name === concept
        )
          score += 50;

        if (
          trap &&
          target.name === trap
        )
          score += 45;

        if (
          topic &&
          target.name === topic
        )
          score += 35;

        if (
          chapter &&
          target.name === chapter
        )
          score += 25;

      }
    );

    if (
      q?.unseen === true
    )
      score += 20;

    if (
      q?.verified === true
    )
      score += 15;

    if (
      q?.nichod === true
    )
      score += 15;

    return score;

  }

  function adaptiveSort(pool) {

    if (
      !Array.isArray(pool) ||
      !pool.length
    )
      return pool;

    return pool
      .map(
        (q, index) => ({
          q,
          index,
          score:
            selectQuestionScore(q)
        })
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.index - b.index
      )
      .map(
        x => x.q
      );

  }

  function applyToRanker() {

    try {

      const selected =
        read(
          "rbSelectedQuestions",
          null
        );

      if (
        Array.isArray(selected) &&
        selected.length
      ) {

        const sorted =
          adaptiveSort(
            selected
          );

        write(
          "rbSelectedQuestions",
          sorted
        );

        return sorted;

      }

    } catch (_) {}

    return null;

  }

  function buildNextAction() {

    const weaknesses =
      weaknessMap();

    if (!weaknesses.length) {

      return {
        mode: "coverage",
        action:
          "Generate new unseen PCB NICHOD questions across Physics, Chemistry and Biology."
      };

    }

    const top =
      weaknesses[0];

    return {

      mode: "recovery",

      action:
        "Target " +
        top.type +
        ": " +
        top.name,

      target:
        top.name,

      targetType:
        top.type,

      accuracy:
        Math.round(
          top.accuracy
        )

    };

  }

  function saveNextAction() {

    const plan =
      getPlan();

    plan.nextAction =
      buildNextAction();

    plan.updatedAt =
      new Date().toISOString();

    write(
      PLAN_KEY,
      plan
    );

    return plan.nextAction;

  }

  function processResult(result) {

    let output = null;

    try {

      if (
        window.PCBNICHODPostTest &&
        typeof
        window.PCBNICHODPostTest.process
        === "function"
      ) {

        output =
          window.PCBNICHODPostTest
            .process(result);

      }

    } catch (_) {}

    buildPlan();
    saveNextAction();

    return output;

  }

  function hookLifecycle() {

    try {

      const lifecycle =
        window.RankerV11Lifecycle;

      if (
        !lifecycle ||
        typeof lifecycle.completePost
        !== "function"
      )
        return;

      if (
        lifecycle.__nichodUnifiedHook
      )
        return;

      const original =
        lifecycle.completePost;

      lifecycle.completePost =
        function () {

          let result;

          try {
            result =
              lifecycle
                .getCompletedResult
                ?.();
          } catch (_) {
            result = null;
          }

          const out =
            original.apply(
              this,
              arguments
            );

          processResult(
            result
          );

          return out;

        };

      lifecycle.__nichodUnifiedHook =
        true;

    } catch (_) {}

  }

  function hookSelection() {

    try {

      const original =
        window.PCBNICHODVerifiedFeed
          ?.prepareSelection;

      if (
        typeof original !==
        "function"
      )
        return;

      if (
        original.__nichodUnifiedHook
      )
        return;

      const wrapped =
        function () {

          const result =
            original.apply(
              this,
              arguments
            );

          if (
            Array.isArray(result)
          )
            return adaptiveSort(
              result
            );

          return result;

        };

      wrapped.__nichodUnifiedHook =
        true;

      window.PCBNICHODVerifiedFeed
        .prepareSelection =
        wrapped;

    } catch (_) {}

  }

  function boot() {

    buildPlan();
    saveNextAction();

    hookLifecycle();
    hookSelection();

    applyToRanker();

    setTimeout(
      function () {

        hookLifecycle();
        hookSelection();
        applyToRanker();

      },
      1200
    );

    setTimeout(
      function () {

        hookLifecycle();
        hookSelection();

      },
      3000
    );

  }

  window.PCBNICHODUnified = {

    SUBJECTS,

    buildPlan,
    getPlan,
    buildNextAction,
    saveNextAction,
    processResult,
    adaptiveSort,
    applyToRanker,
    weaknessMap

  };

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      boot
    );

  } else {

    boot();

  }

})();
