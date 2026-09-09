
(function () {
  "use strict";

  /*
   * ==========================================================
   * CBT SOURCE ISOLATION V1
   * ==========================================================
   *
   * Every CBT source owns:
   *   - question pool
   *   - selected questions
   *   - session
   *   - attempts
   *   - no-repeat history
   *
   * Common CBT renderer is allowed.
   * Common question storage is NOT allowed.
   */

  const NS = {
    PDF: "CBT_ISO_PDF_CBT",
    RANKER: "CBT_ISO_RANKER_QUESTIONS",
    SERIES: "CBT_ISO_RANKER_TEST_SERIES",
    NORMAL: "CBT_ISO_NORMAL_CBT"
  };

  function read(key, fallback) {
    try {
      const x = localStorage.getItem(key);
      return x ? JSON.parse(x) : fallback;
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

  function uniqueQuestions(list) {
    if (!Array.isArray(list))
      return [];

    const seen = new Set();

    return list.filter(function (q, i) {
      if (!q || typeof q !== "object")
        return false;

      const id =
        String(
          q.id ||
          q.questionId ||
          q.question ||
          q.text ||
          ("q-" + i)
        ).trim();

      if (!id || seen.has(id))
        return false;

      seen.add(id);
      return true;
    });
  }

  function namespace(source) {
    switch (String(source || "").trim()) {
      case "PDF":
      case "PDF Import":
        return NS.PDF;

      case "Ranker":
      case "Ranker Questions":
        return NS.RANKER;

      case "Rankers Test Series":
      case "Test Series":
        return NS.SERIES;

      default:
        return NS.NORMAL;
    }
  }

  function keys(source) {
    const n = namespace(source);

    return {
      pool: n + "_POOL",
      selected: n + "_SELECTED",
      session: n + "_SESSION",
      attempts: n + "_ATTEMPTS",
      used: n + "_USED"
    };
  }

  function saveSelection(source, questions) {
    const k = keys(source);
    const clean = uniqueQuestions(questions);

    write(k.selected, clean);

    write(k.session, {
      source: source,
      createdAt: Date.now(),
      questionIds: clean.map(function (q, i) {
        return String(
          q.id ||
          q.questionId ||
          ("q-" + i)
        );
      })
    });

    return clean;
  }

  function savePool(source, questions) {
    const k = keys(source);
    const clean = uniqueQuestions(questions);

    write(k.pool, clean);

    return clean;
  }

  function markUsed(source, questions) {
    const k = keys(source);
    const used = new Set(read(k.used, []));

    uniqueQuestions(questions).forEach(
      function (q, i) {
        used.add(
          String(
            q.id ||
            q.questionId ||
            ("q-" + i)
          )
        );
      }
    );

    write(k.used, Array.from(used));
  }

  function unused(source, questions) {
    const k = keys(source);
    const used = new Set(read(k.used, []));

    return uniqueQuestions(questions)
      .filter(function (q, i) {
        const id =
          String(
            q.id ||
            q.questionId ||
            ("q-" + i)
          );

        return !used.has(id);
      });
  }

  window.CBTSourceIsolation = {
    NS,
    namespace,
    keys,
    read,
    write,
    savePool,
    saveSelection,
    markUsed,
    unused
  };

})();
