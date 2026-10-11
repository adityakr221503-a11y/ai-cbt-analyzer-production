/*
=========================================================
 PCB NICHOD × RANKER PRO
 Integration Layer v1
=========================================================
 Physics + Chemistry + Biology
 Existing Ranker/CBT preserved.
=========================================================
*/

(function () {
  "use strict";

  const VERSION = "PCB-NICHOD-1.0";

  const CONFIG = {
    unseen: 0.20,
    diamond: 0.20,
    trap: 0.20,
    pyqFamily: 0.20,
    weakArea: 0.20
  };

  const STORAGE = {
    selected: "rbSelectedQuestions",
    profile: "pcbNichodProfile",
    stats: "pcbNichodStats",
    config: "pcbNichodConfig"
  };

  function safeJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function subjectOf(q) {
    const s = normalize(
      q.subject ||
      q.section ||
      q.sub ||
      q.stream ||
      ""
    );

    if (s.includes("phys")) return "Physics";
    if (s.includes("chem")) return "Chemistry";
    if (
      s.includes("bio") ||
      s.includes("bot") ||
      s.includes("zoo")
    ) return "Biology";

    return "Unknown";
  }

  function difficultyOf(q) {
    const d = normalize(
      q.difficulty ||
      q.level ||
      q.difficultyLevel ||
      ""
    );

    if (d.includes("hard") || d.includes("tough"))
      return "hard";

    if (d.includes("easy"))
      return "easy";

    if (d.includes("medium") || d.includes("moderate"))
      return "medium";

    return "other";
  }

  function textOf(q) {
    return normalize(
      q.question ||
      q.text ||
      q.prompt ||
      q.statement ||
      ""
    );
  }

  function hasTag(q, words) {
    const hay = normalize([
      q.tags,
      q.tag,
      q.type,
      q.category,
      q.questionType,
      q.topic,
      q.model,
      q.concept,
      q.trap,
      q.source
    ].join(" "));

    return words.some(x => hay.includes(x));
  }

  function isDiamond(q) {
    return Boolean(
      q.diamond === true ||
      q.isDiamond === true ||
      hasTag(q, ["diamond", "rank-booster", "rank booster"])
    );
  }

  function isTrap(q) {
    return Boolean(
      q.trap === true ||
      q.isTrap === true ||
      hasTag(q, [
        "trap",
        "misconception",
        "statement trap",
        "exam trap"
      ])
    );
  }

  function isUnseen(q) {
    return Boolean(
      q.unseen === true ||
      q.isUnseen === true ||
      hasTag(q, [
        "unseen",
        "novel",
        "original",
        "new pattern"
      ])
    );
  }

  function familyOf(q) {
    return normalize(
      q.pyqFamily ||
      q.family ||
      q.questionFamily ||
      q.model ||
      q.concept ||
      q.topic ||
      textOf(q).slice(0, 80)
    );
  }

  function uniqueByQuestion(pool) {
    const seen = new Set();

    return pool.filter(q => {
      const key = normalize(
        q.id ||
        q.questionId ||
        q.question ||
        q.text
      );

      if (!key || seen.has(key))
        return false;

      seen.add(key);
      return true;
    });
  }

  function score(q) {
    let score = 0;

    if (isDiamond(q)) score += 40;
    if (isTrap(q)) score += 30;
    if (isUnseen(q)) score += 30;

    if (q.pyqFamily || q.family)
      score += 20;

    if (
      q.concept ||
      q.topic ||
      q.model
    )
      score += 10;

    if (
      q.explanation ||
      q.solution
    )
      score += 10;

    return score;
  }

  function shuffle(a) {
    return a
      .map(x => ({ x, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(x => x.x);
  }

  function takeBest(source, count) {
    return [...source]
      .sort((a, b) =>
        score(b) - score(a)
      )
      .slice(0, count);
  }

  function allocate(pool, total) {

    pool = uniqueByQuestion(
      Array.isArray(pool) ? pool : []
    );

    if (!pool.length)
      return [];

    const subjects = {
      Physics: [],
      Chemistry: [],
      Biology: [],
      Unknown: []
    };

    pool.forEach(q => {
      subjects[subjectOf(q)].push(q);
    });

    /*
      Subject balancing.
      We do NOT force missing subjects.
    */

    const activeSubjects =
      Object.keys(subjects)
        .filter(s => subjects[s].length);

    const result = [];

    /*
      First guarantee subject spread.
    */

    let cursor = 0;

    while (
      result.length < total &&
      activeSubjects.length
    ) {

      const subject =
        activeSubjects[
          cursor % activeSubjects.length
        ];

      const bucket =
        subjects[subject];

      if (bucket.length)
        result.push(
          takeBest(bucket, 1)[0]
        );

      cursor++;

      if (
        cursor >
        total * activeSubjects.length * 2
      )
        break;
    }

    /*
      Then fill using NICHOD priority.
    */

    const remaining =
      pool.filter(
        q => !result.includes(q)
      );

    const priority = [
      ...remaining.filter(isDiamond),
      ...remaining.filter(isTrap),
      ...remaining.filter(isUnseen),
      ...remaining
    ];

    for (const q of priority) {

      if (result.length >= total)
        break;

      if (!result.includes(q))
        result.push(q);
    }

    /*
      Difficulty distribution.
    */

    const buckets = {
      easy: [],
      medium: [],
      hard: [],
      other: []
    };

    result.forEach(q => {
      buckets[difficultyOf(q)].push(q);
    });

    const balanced = [];

    const order = [
      "medium",
      "hard",
      "easy",
      "other"
    ];

    while (
      balanced.length < result.length
    ) {

      let added = false;

      for (const key of order) {

        if (buckets[key].length) {

          balanced.push(
            buckets[key].shift()
          );

          added = true;
        }

        if (
          balanced.length >= result.length
        )
          break;
      }

      if (!added)
        break;
    }

    return uniqueByQuestion(
      shuffle(balanced)
    );
  }

  function analyze(pool) {

    const data = {
      version: VERSION,
      total: pool.length,
      subjects: {},
      diamonds: 0,
      traps: 0,
      unseen: 0,
      families: new Set()
    };

    pool.forEach(q => {

      const s = subjectOf(q);

      data.subjects[s] =
        (data.subjects[s] || 0) + 1;

      if (isDiamond(q))
        data.diamonds++;

      if (isTrap(q))
        data.traps++;

      if (isUnseen(q))
        data.unseen++;

      data.families.add(
        familyOf(q)
      );
    });

    data.families =
      data.families.size;

    return data;
  }

  function save(pool) {

    localStorage.setItem(
      STORAGE.selected,
      JSON.stringify(pool)
    );

    const stats = analyze(pool);

    localStorage.setItem(
      STORAGE.stats,
      JSON.stringify({
        ...stats,
        updatedAt:
          new Date().toISOString()
      })
    );
  }

  /*
  ========================================================
  PUBLIC API
  ========================================================
  */

  window.PCBNICHOD = {

    version: VERSION,

    config: CONFIG,

    subjectOf,

    difficultyOf,

    isDiamond,

    isTrap,

    isUnseen,

    familyOf,

    uniqueByQuestion,

    analyze,

    allocate,

    save,

    generateRankerPool(
      sourcePool,
      testSize
    ) {

      const size =
        Number(testSize) ||
        sourcePool.length;

      const selected =
        allocate(
          sourcePool,
          size
        );

      save(selected);

      return selected;
    }
  };

  /*
  ========================================================
  OPTIONAL AUTO-INTEGRATION
  ========================================================
  Runs only when Ranker selected questions
  already exist in localStorage.
  ========================================================
  */

  try {

    const existing =
      safeJSON(
        STORAGE.selected,
        null
      );

    if (
      Array.isArray(existing) &&
      existing.length
    ) {

      const improved =
        allocate(
          existing,
          existing.length
        );

      if (improved.length)
        save(improved);
    }

  } catch (e) {

    console.warn(
      "PCB NICHOD initialization skipped:",
      e
    );
  }

})();
