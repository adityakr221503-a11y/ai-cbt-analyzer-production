"use strict";

/*
=========================================================
 PCB NICHOD — GENERATION BRIDGE
 ========================================================
 Connects:
   NICHOD unseen candidates
        ↓
   generation adapter
        ↓
   structural validation
        ↓
   verified unseen pool
        ↓
   Ranker Test Series
=========================================================
*/

(function () {

  const CANDIDATE_KEY =
    "pcbNichodUnseenCandidates";

  const VERIFIED_KEY =
    "pcbNichodVerifiedUnseen";

  const RANKER_KEY =
    "rbSelectedQuestions";

  function read(key, fallback) {

    try {

      const value =
        JSON.parse(
          localStorage.getItem(key) ||
          "null"
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

  function clean(v) {

    return String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();

  }

  function normalizeAnswer(v) {

    return clean(v)
      .toLowerCase()
      .replace(/^[\(\[]?([a-d])[)\].:\- ]*/i, "$1")
      .trim();

  }

  function questionKey(q) {

    return clean(
      q.id ||
      q.question ||
      q.text
    ).toLowerCase();

  }

  /*
  -------------------------------------------------------
  Validate actual generated question
  -------------------------------------------------------
  */

  function validate(q) {

    const errors = [];

    if (!q)
      errors.push(
        "empty-question"
      );

    const question =
      clean(
        q?.question ||
        q?.text
      );

    if (!question)
      errors.push(
        "missing-question"
      );

    if (
      !Array.isArray(
        q?.options
      )
    ) {

      errors.push(
        "missing-options"
      );

    } else {

      if (
        q.options.length !== 4
      )
        errors.push(
          "options-must-be-4"
        );

      const opts =
        q.options
          .map(clean)
          .filter(Boolean);

      if (
        new Set(
          opts.map(
            x =>
              x.toLowerCase()
          )
        ).size !==
        opts.length
      )
        errors.push(
          "duplicate-options"
        );

    }

    const answer =
      normalizeAnswer(
        q?.answer ??
        q?.correctAnswer
      );

    if (!answer)
      errors.push(
        "missing-answer"
      );

    /*
     * Answer must correspond to one option.
     */

    if (
      Array.isArray(q?.options) &&
      answer
    ) {

      const index =
        q.options.findIndex(
          (option, i) => {

            const letter =
              String.fromCharCode(
                97 + i
              );

            return (
              answer === letter ||
              answer ===
                normalizeAnswer(
                  option
                )
            );

          }
        );

      if (index < 0)
        errors.push(
          "answer-not-in-options"
        );

    }

    /*
     * Explanation is mandatory for
     * promotion to verified pool.
     */

    if (
      !clean(
        q?.explanation ||
        q?.solution
      )
    )
      errors.push(
        "missing-explanation"
      );

    /*
     * Generated question cannot silently
     * become verified.
     */

    if (
      q?.verified !== true
    )
      errors.push(
        "not-verified"
      );

    return {

      valid:
        errors.length === 0,

      errors

    };

  }

  /*
  -------------------------------------------------------
  Convert answer to canonical letter
  -------------------------------------------------------
  */

  function canonicalAnswer(q) {

    const raw =
      normalizeAnswer(
        q.answer ??
        q.correctAnswer
      );

    if (
      /^[a-d]$/.test(raw)
    )
      return raw;

    const index =
      q.options.findIndex(
        option =>
          normalizeAnswer(
            option
          ) === raw
      );

    if (index < 0)
      return "";

    return String.fromCharCode(
      97 + index
    );

  }

  /*
  -------------------------------------------------------
  Prepare generated question
  -------------------------------------------------------
  */

  function prepare(candidate, generated) {

    const q = {

      ...generated,

      id:
        generated.id ||
        candidate.id,

      source:
        "PCB NICHOD Unseen",

      generatedFrom:
        candidate.generatedFrom,

      generatedFromFamily:
        candidate.generatedFromFamily,

      variationStrategy:
        candidate.variationStrategy,

      subject:
        generated.subject ||
        candidate.subject,

      chapter:
        generated.chapter ||
        candidate.chapter,

      topic:
        generated.topic ||
        candidate.topic,

      concepts:
        generated.concepts ||
        candidate.concepts ||
        [],

      traps:
        generated.traps ||
        candidate.traps ||
        [],

      shortcuts:
        generated.shortcuts ||
        candidate.shortcuts ||
        [],

      unseen:
        true,

      /*
       * Only an explicit true can promote it.
       */

      verified:
        generated.verified === true,

      createdAt:
        generated.createdAt ||
        new Date().toISOString()

    };

    q.answer =
      canonicalAnswer(q);

    return q;

  }

  /*
  -------------------------------------------------------
  Store verified question
  -------------------------------------------------------
  */

  function promote(
    candidateId,
    generated
  ) {

    const candidates =
      read(
        CANDIDATE_KEY,
        []
      );

    if (
      !Array.isArray(candidates)
    )
      return {
        ok: false,
        reason:
          "candidate-store-invalid"
      };

    const candidate =
      candidates.find(
        x =>
          x.id === candidateId
      );

    if (!candidate)
      return {
        ok: false,
        reason:
          "candidate-not-found"
      };

    const q =
      prepare(
        candidate,
        generated || {}
      );

    const result =
      validate(q);

    if (!result.valid) {

      return {

        ok: false,

        errors:
          result.errors

      };

    }

    const verified =
      read(
        VERIFIED_KEY,
        []
      );

    const list =
      Array.isArray(verified)
        ? verified
        : [];

    const key =
      questionKey(q);

    const duplicate =
      list.some(
        x =>
          questionKey(x) === key
      );

    if (duplicate) {

      return {

        ok: false,

        reason:
          "duplicate-verified-question"

      };

    }

    list.push(q);

    write(
      VERIFIED_KEY,
      list
    );

    /*
     * Mark source candidate as promoted.
     */

    const updated =
      candidates.map(x => {

        if (
          x.id !== candidateId
        )
          return x;

        return {

          ...x,

          status:
            "VERIFIED",

          promotedAt:
            new Date().toISOString()

        };

      });

    write(
      CANDIDATE_KEY,
      updated
    );

    return {

      ok: true,

      question: q,

      total:
        list.length

    };

  }

  /*
  -------------------------------------------------------
  Get verified unseen questions
  -------------------------------------------------------
  */

  function getVerified(options = {}) {

    const list =
      read(
        VERIFIED_KEY,
        []
      );

    if (
      !Array.isArray(list)
    )
      return [];

    let out =
      list.filter(
        q =>
          q.unseen === true &&
          q.verified === true
      );

    if (
      options.subject
    ) {

      out =
        out.filter(
          q =>
            clean(
              q.subject
            ).toLowerCase() ===
            clean(
              options.subject
            ).toLowerCase()
        );

    }

    return out;

  }

  /*
  -------------------------------------------------------
  Build unseen Ranker test
  -------------------------------------------------------
  */

  function buildTest(
    options = {}
  ) {

    const count =
      Math.max(
        1,
        Number(
          options.count || 45
        )
      );

    let pool =
      getVerified(
        options
      );

    /*
     * Family diversity.
     */

    const families =
      new Set();

    const selected = [];

    for (
      const q of pool
    ) {

      if (
        selected.length >=
        count
      )
        break;

      const f =
        clean(
          q.generatedFromFamily ||
          q.topic ||
          q.chapter
        ).toLowerCase();

      if (
        !families.has(f)
      ) {

        families.add(f);
        selected.push(q);

      }

    }

    /*
     * Fill remaining slots.
     */

    const selectedKeys =
      new Set(
        selected.map(
          questionKey
        )
      );

    for (
      const q of pool
    ) {

      if (
        selected.length >=
        count
      )
        break;

      if (
        !selectedKeys.has(
          questionKey(q)
        )
      ) {

        selected.push(q);
        selectedKeys.add(
          questionKey(q)
        );

      }

    }

    write(
      RANKER_KEY,
      selected
    );

    write(
      "CBT_ACTIVE_SOURCE",
      "PCB NICHOD Unseen Ranker"
    );

    write(
      "PCB_NICHOD_UNSEEN_ACTIVE_TEST",
      {

        id:
          "NICHOD-UNSEEN-" +
          Date.now(),

        source:
          "PCB NICHOD Unseen Ranker",

        createdAt:
          new Date().toISOString(),

        count:
          selected.length,

        questions:
          selected

      }
    );

    return {

      ok:
        selected.length > 0,

      count:
        selected.length,

      questions:
        selected

    };

  }

  /*
  -------------------------------------------------------
  Public API
  -------------------------------------------------------
  */

  window.PCBNICHODGeneration = {

    validate,

    prepare,

    promote,

    getVerified,

    buildTest

  };

})();
