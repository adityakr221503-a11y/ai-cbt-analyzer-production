"use strict";

/*
=========================================================
 PCB NICHOD — VERIFIED UNSEEN RANKER FEED v1
=========================================================
Verified NICHOD questions
        ↓
Ranker Test Series
        ↓
Unseen-first selection
        ↓
No duplicate questions
        ↓
Existing Ranker lifecycle remains intact
=========================================================
*/

(function () {

  const VERIFIED_KEY =
    "pcbNichodVerifiedUnseenPool";

  const USED_KEY =
    "pcbNichodUsedUnseenIds";

  const SELECTED_KEY =
    "rbSelectedQuestions";

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

  function idOf(q) {
    return clean(
      q?.id ||
      q?.questionId ||
      q?.candidateId ||
      q?.question
    ).toLowerCase();
  }

  function questionOf(q) {
    return clean(
      q?.question ||
      q?.text ||
      q?.originalQuestion
    );
  }

  function normalize(q) {

    if (!q)
      return null;

    const question =
      questionOf(q);

    if (!question)
      return null;

    const options =
      Array.isArray(q.options)
        ? q.options.slice(0, 4)
        : [];

    if (options.length !== 4)
      return null;

    return Object.assign(
      {},
      q,
      {
        id:
          idOf(q),

        question,

        options,

        answer:
          clean(
            q.answer ||
            q.correctAnswer
          ).toLowerCase(),

        subject:
          clean(q.subject),

        topic:
          clean(q.topic),

        chapter:
          clean(q.chapter),

        source:
          "PCB NICHOD",

        unseen:
          true,

        verified:
          true,

        rankerEligible:
          true
      }
    );
  }

  function getVerified() {

    const pool =
      read(
        VERIFIED_KEY,
        []
      );

    if (!Array.isArray(pool))
      return [];

    const seen =
      new Set();

    return pool
      .map(normalize)
      .filter(Boolean)
      .filter(function(q){

        const id =
          idOf(q);

        if(!id || seen.has(id))
          return false;

        seen.add(id);

        return true;

      });

  }

  function getUsed() {

    const used =
      read(
        USED_KEY,
        []
      );

    return new Set(
      Array.isArray(used)
        ? used.map(
            x =>
              clean(x).toLowerCase()
          )
        : []
    );

  }

  function getFresh(limit) {

    const used =
      getUsed();

    const fresh =
      getVerified()
        .filter(function(q){

          return !used.has(
            idOf(q)
          );

        });

    if (!limit)
      return fresh;

    return fresh.slice(
      0,
      Math.max(
        0,
        Number(limit)
      )
    );

  }

  function markUsed(questions) {

    const used =
      getUsed();

    (
      Array.isArray(questions)
        ? questions
        : []
    ).forEach(function(q){

      const id =
        idOf(q);

      if(id)
        used.add(id);

    });

    write(
      USED_KEY,
      Array.from(used)
    );

  }

  function mergeIntoPool(
    existing,
    options = {}
  ) {

    const base =
      Array.isArray(existing)
        ? existing.slice()
        : [];

    const limit =
      Math.max(
        0,
        Number(
          options.unseenCount ||
          options.limit ||
          0
        )
      );

    const unseen =
      getFresh(
        limit || undefined
      );

    const keys =
      new Set(
        base.map(
          idOf
        ).filter(Boolean)
      );

    const added = [];

    unseen.forEach(function(q){

      const key =
        idOf(q);

      if(!key)
        return;

      if(keys.has(key))
        return;

      keys.add(key);

      base.push(q);
      added.push(q);

    });

    return {
      pool: base,
      added
    };

  }

  function inject(
    existing,
    options = {}
  ) {

    const result =
      mergeIntoPool(
        existing,
        options
      );

    return result.pool;

  }

  function prepareSelection(
    questions,
    options = {}
  ) {

    const count =
      Math.max(
        1,
        Number(
          options.count || 180
        )
      );

    const result =
      mergeIntoPool(
        questions,
        {
          unseenCount:
            options.unseenCount ||
            count
        }
      );

    /*
     * Put fresh NICHOD questions first.
     * Existing Ranker logic can then
     * balance/reorder the remaining pool.
     */

    const freshIds =
      new Set(
        result.added.map(
          idOf
        )
      );

    const unseen =
      result.pool.filter(
        q =>
          freshIds.has(
            idOf(q)
          )
      );

    const old =
      result.pool.filter(
        q =>
          !freshIds.has(
            idOf(q)
          )
      );

    const finalPool =
      unseen.concat(old)
        .slice(0, count);

    write(
      SELECTED_KEY,
      finalPool
    );

    return {
      pool: finalPool,
      added:
        result.added,
      unseenCount:
        unseen.length
    };

  }

  function stats() {

    const verified =
      getVerified();

    const used =
      getUsed();

    const fresh =
      verified.filter(
        q =>
          !used.has(
            idOf(q)
          )
      );

    return {
      verified:
        verified.length,

      fresh:
        fresh.length,

      used:
        verified.length -
        fresh.length
    };

  }

  window.PCBNICHODVerifiedFeed = {

    getVerified,
    getFresh,
    markUsed,
    mergeIntoPool,
    inject,
    prepareSelection,
    stats

  };

})();
