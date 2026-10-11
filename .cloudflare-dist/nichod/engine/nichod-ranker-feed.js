"use strict";

/*
=========================================================
 PCB NICHOD → RANKER FEED
 v1
=========================================================
NICHOD corpus
   ↓
dedupe
   ↓
verified/source filtering
   ↓
subject balance
   ↓
concept/family diversity
   ↓
unseen preference
   ↓
Ranker selection
=========================================================
*/

(function () {

  const CORPUS_KEY = "pcbNichodCorpus";
  const SELECTED_KEY = "rbSelectedQuestions";
  const SOURCE_KEY = "CBT_ACTIVE_SOURCE";

  function clean(v) {
    return String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readCorpus() {

    try {

      const raw =
        JSON.parse(
          localStorage.getItem(
            CORPUS_KEY
          ) || "[]"
        );

      return Array.isArray(raw)
        ? raw
        : [];

    } catch (_) {

      return [];
    }
  }

  function questionKey(q) {

    return clean(
      q.id ||
      q.nichodId ||
      q.question
    ).toLowerCase();
  }

  function dedupe(list) {

    const seen = new Set();

    return list.filter(q => {

      const key =
        questionKey(q);

      if (!key || seen.has(key))
        return false;

      seen.add(key);
      return true;
    });
  }

  function getSubject(q) {

    return clean(
      q.subject ||
      q.section ||
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
    ).toLowerCase();
  }

  function score(q, options) {

    let score = 0;

    /*
     * Verified content gets priority.
     */

    if (q.verified === true)
      score += 100;

    /*
     * Previously unseen questions are preferred
     * for new Ranker tests.
     */

    if (
      options.preferUnseen &&
      q.unseen === true
    )
      score += 60;

    /*
     * Diamond candidates.
     */

    if (
      q.diamond === true
    )
      score += 50;

    if (
      q.diamondCandidate === true
    )
      score += 30;

    /*
     * Concept/trap richness.
     */

    if (
      Array.isArray(q.concepts)
    )
      score +=
        Math.min(
          q.concepts.length * 8,
          24
        );

    if (
      Array.isArray(q.traps)
    )
      score +=
        Math.min(
          q.traps.length * 10,
          20
        );

    if (
      Array.isArray(q.shortcuts)
    )
      score +=
        Math.min(
          q.shortcuts.length * 8,
          16
        );

    /*
     * Difficulty.
     */

    if (q.difficulty === "hard")
      score += 20;

    if (q.difficulty === "very-hard")
      score += 30;

    /*
     * Small random component keeps
     * equivalent candidates from producing
     * identical tests repeatedly.
     */

    score +=
      Math.random() * 8;

    return score;
  }

  function shuffle(list) {

    const a =
      list.slice();

    for (
      let i = a.length - 1;
      i > 0;
      i--
    ) {

      const j =
        Math.floor(
          Math.random() *
          (i + 1)
        );

      [
        a[i],
        a[j]
      ] = [
        a[j],
        a[i]
      ];
    }

    return a;
  }

  function select(options = {}) {

    const corpus =
      dedupe(
        readCorpus()
      );

    if (!corpus.length)
      return [];

    const requested =
      Math.max(
        1,
        Number(
          options.count || 45
        )
      );

    const subjects =
      options.subjects ||
      [
        "Physics",
        "Chemistry",
        "Biology"
      ];

    /*
     * Only real NICHOD records.
     * Do not invent fallback questions.
     */

    let pool =
      corpus.filter(q => {

        if (
          options.requireVerified &&
          q.verified !== true
        )
          return false;

        if (
          options.subject &&
          getSubject(q) !==
            options.subject
        )
          return false;

        return true;
      });

    /*
     * Rank candidates.
     */

    pool =
      pool
        .map(q => ({
          q,
          score:
            score(
              q,
              options
            )
        }))
        .sort(
          (a,b) =>
            b.score -
            a.score
        )
        .map(x => x.q);

    /*
     * Prefer diversity of PYQ families.
     */

    const usedFamilies =
      new Set();

    const selected = [];

    for (const q of pool) {

      if (
        selected.length >=
        requested
      )
        break;

      const f =
        family(q);

      if (
        !usedFamilies.has(f)
      ) {

        selected.push(q);
        usedFamilies.add(f);
      }
    }

    /*
     * Fill remaining slots.
     */

    if (
      selected.length <
      requested
    ) {

      const selectedKeys =
        new Set(
          selected.map(
            questionKey
          )
        );

      for (const q of shuffle(pool)) {

        if (
          selected.length >=
          requested
        )
          break;

        const key =
          questionKey(q);

        if (
          !selectedKeys.has(key)
        ) {

          selected.push(q);
          selectedKeys.add(key);
        }
      }
    }

    return selected.slice(
      0,
      requested
    );
  }

  function createRankerTest(options = {}) {

    const questions =
      select(options);

    if (!questions.length) {

      return {
        ok: false,
        count: 0,
        reason:
          "No NICHOD questions available"
      };
    }

    const test = {

      id:
        "NICHOD-RANKER-" +
        Date.now(),

      source:
        "PCB NICHOD → Ranker",

      createdAt:
        new Date().toISOString(),

      count:
        questions.length,

      subjects:
        [...new Set(
          questions.map(
            getSubject
          )
        )],

      questions
    };

    localStorage.setItem(
      SELECTED_KEY,
      JSON.stringify(
        questions
      )
    );

    localStorage.setItem(
      SOURCE_KEY,
      "PCB NICHOD Ranker"
    );

    localStorage.setItem(
      "PCB_NICHOD_ACTIVE_TEST",
      JSON.stringify(
        test
      )
    );

    return {
      ok: true,
      count:
        questions.length,
      test
    };
  }

  window.PCBNICHODRanker = {

    readCorpus,
    dedupe,
    select,
    createRankerTest

  };

})();
