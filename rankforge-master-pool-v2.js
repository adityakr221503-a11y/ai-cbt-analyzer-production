(function (global) {
  "use strict";

  /*
   * RankForge Master Question Pool V2
   * Stable intelligence layer.
   *
   * IMPORTANT:
   * - TOPPER_TEST_180 is NEVER modified.
   * - Unvalidated DPP parser output is NOT automatically imported.
   * - Large master pool is stored in IndexedDB.
   */

  const DB_NAME = "RankForgeMasterPoolV2DB";
  const DB_VERSION = 1;
  const STORE = "questions";
  const MASTER_KEY = "rankForgeMasterQuestionPoolV2";

  const SOURCE_KEYS = {
    ranker: [
      "rankBoosterQuestionBankV1",
      "rankForgeQuestionBank",
      "rankerQuestionBank"
    ],
    pdf: [
      "pdfCbtQuestions",
      "pdfQuestionBank",
      "pdfQuestions"
    ],
    nichod: [
      "pcbNichodCorpus",
      "pcbNichodCBTSnapshot"
    ],
    dpp: [
      "rankforgeAdaptiveDPPV1"
    ],
    ai: [
      "rankForgeAIQuestionBankV1"
    ]
  };

  const api = {};

  function text(v) {
    return String(v ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function norm(v) {
    return text(v)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function jsonLS(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (_) {
      return null;
    }
  }

  function flatten(v, out = []) {
    if (!v) return out;

    if (Array.isArray(v)) {
      v.forEach(x => flatten(x, out));
      return out;
    }

    if (typeof v === "object") {
      if (Array.isArray(v.questions)) return flatten(v.questions, out);
      if (Array.isArray(v.items)) return flatten(v.items, out);

      if (
        v.text ||
        v.question ||
        v.prompt ||
        v.options ||
        v.choices
      ) {
        out.push(v);
      }
    }

    return out;
  }

  function optionText(o) {
    if (typeof o === "string") return text(o);
    if (o && typeof o === "object") {
      return text(o.text ?? o.value ?? o.answer ?? o.label ?? "");
    }
    return "";
  }

  function correctIndex(q, options) {
    const raw =
      q.correctIndex ??
      q.correctAnswer ??
      q.correct ??
      q.answer ??
      q.correctOption ??
      q.rightAnswer;

    if (typeof raw === "number" && Number.isInteger(raw)) {
      if (raw >= 0 && raw < options.length) return raw;
      if (raw >= 1 && raw <= options.length) return raw - 1;
    }

    if (raw && typeof raw === "object") {
      return correctIndex(raw, options);
    }

    if (typeof raw === "string") {
      const s = text(raw);

      const letter = s.match(
        /^(?:option\s*)?([A-D])(?:[\s\).:]|$)/i
      );

      if (letter) {
        const i =
          letter[1].toUpperCase().charCodeAt(0) - 65;
        if (i >= 0 && i < options.length) return i;
      }

      const n = Number(s);

      if (Number.isInteger(n)) {
        if (n >= 0 && n < options.length) return n;
        if (n >= 1 && n <= options.length) return n - 1;
      }

      const exact = options.findIndex(
        x => norm(x) === norm(s)
      );

      if (exact >= 0) return exact;
    }

    return -1;
  }

  function hash(s) {
    let h = 2166136261;

    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return (h >>> 0).toString(16);
  }

  function words(s) {
    return new Set(
      norm(s)
        .split(/\s+/)
        .filter(x => x.length >= 3)
    );
  }

  function jaccard(a, b) {
    let common = 0;

    a.forEach(x => {
      if (b.has(x)) common++;
    });

    const union = a.size + b.size - common;

    return union ? common / union : 0;
  }

  function editSimilarity(a, b) {
    a = norm(a);
    b = norm(b);

    if (a === b) return 1;
    if (!a || !b) return 0;

    const prev = Array.from(
      { length: b.length + 1 },
      (_, i) => i
    );

    let row = prev;

    for (let i = 1; i <= a.length; i++) {
      const next = [i];

      for (let j = 1; j <= b.length; j++) {
        next[j] = Math.min(
          next[j - 1] + 1,
          row[j] + 1,
          row[j - 1] +
            (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }

      row = next;
    }

    return 1 -
      row[b.length] /
      Math.max(a.length, b.length);
  }

  function similarity(a, b) {
    return (
      jaccard(words(a), words(b)) * 0.72 +
      editSimilarity(a, b) * 0.28
    );
  }

  function quality(q) {
    let s = 0;

    if (q.options.length === 4) s += 20;
    else if (q.options.length >= 3) s += 14;
    else s += 5;

    if (q.correctIndex >= 0) s += 15;
    if (q.subject) s += 10;
    if (q.chapter) s += 10;
    if (q.topic) s += 10;

    if (q.text.length >= 60) s += 5;
    if (q.text.length >= 120) s += 5;

    if (
      /\b(assertion|reason|incorrect|except|match|inference|application|comparison|sequence|graph|experimental|calculate|statement)\b/i
        .test(q.text)
    ) {
      s += 10;
    }

    if (
      /\b(hard|very hard|rank booster|challenging|tricky)\b/i
        .test(q.difficulty)
    ) {
      s += 10;
    }

    return Math.min(100, s);
  }

  function novelty(q) {
    let s = 70;

    if (q.text.length < 50) s -= 10;
    if (!q.topic) s -= 8;
    if (!q.chapter) s -= 5;

    if (
      /\b(define|what is|name the|basic)\b/i.test(q.text)
    ) {
      s -= 8;
    }

    if (
      /\b(inference|application|exception|assertion|reason|comparison|case|scenario|trap|data|graph)\b/i
        .test(q.text)
    ) {
      s += 15;
    }

    return Math.max(0, Math.min(100, s));
  }

  function family(q) {
    return hash([
      norm(q.subject),
      norm(q.chapter),
      norm(q.topic),
      norm(q.text)
        .split(/\s+/)
        .filter(x => x.length >= 5)
        .slice(0, 10)
        .join(" ")
    ].join("|"));
  }

  function sourceType(key) {
    if (key === "rankBoosterQuestionBankV1")
      return "RANKER_QB";

    if (key === "pdfCbtQuestions")
      return "PDF_CBT";

    if (key === "pcbNichodCorpus")
      return "NICHOD";

    if (key === "rankforgeAdaptiveDPPV1")
      return "DPP";

    if (key === "rankForgeAIQuestionBankV1")
      return "AI_GENERATED";

    return "CURATED";
  }

  function normalize(q, key, index) {
    const questionText = text(
      q.text ??
      q.question ??
      q.prompt ??
      q.questionText
    );

    const rawOptions =
      q.options ??
      q.choices ??
      q.answers ??
      [];

    const options = Array.isArray(rawOptions)
      ? rawOptions.map(optionText).filter(Boolean)
      : [];

    const ci = correctIndex(q, options);

    if (
      !questionText ||
      options.length < 2 ||
      ci < 0
    ) {
      return null;
    }

    const result = {
      id: text(
        q.id ??
        q.questionId ??
        q.uid ??
        `${key}-${index}-${hash(norm(questionText))}`
      ),

      text: questionText,
      question: questionText,

      options,

      correctIndex: ci,

      subject: text(q.subject ?? q.sub),
      chapter: text(q.chapter ?? q.unit),
      topic: text(q.topic ?? q.concept),

      difficulty: text(
        q.difficulty ??
        q.level ??
        q.difficultyLevel
      ),

      trapType: text(
        q.trapType ??
        q.trap
      ),

      source: text(
        q.source ??
        q.sourceName ??
        q.origin
      ) || sourceType(key),

      sourceKey: key,
      sourceType: sourceType(key)
    };

    result.fingerprint = hash(
      norm(result.text) +
      "|" +
      result.options.map(norm).join("|")
    );

    result.family = family(result);
    result.qualityScore = quality(result);
    result.noveltyScore = novelty(result);

    result.learningDensity = Math.min(
      100,
      20 +
      (result.subject ? 15 : 0) +
      (result.chapter ? 15 : 0) +
      (result.topic ? 15 : 0) +
      (result.text.length > 80 ? 10 : 0) +
      (result.text.length > 160 ? 10 : 0)
    );

    return result;
  }

  function collect() {
    const result = [];

    Object.entries(SOURCE_KEYS).forEach(
      ([group, keys]) => {
        keys.forEach(key => {
          const data = jsonLS(key);
          if (!data) return;

          flatten(data).forEach((q, i) => {
            const n = normalize(q, key, i);

            if (n) {
              n.sourceGroup = group;
              result.push(n);
            }
          });
        });
      }
    );

    return result;
  }

  function duplicateAgainst(q, accepted) {
    for (const old of accepted) {
      if (q.fingerprint === old.fingerprint) {
        return {
          type: "EXACT_DUPLICATE",
          similarity: 1,
          against: old.id
        };
      }

      const sim = similarity(q.text, old.text);

      if (
        sim >= 0.94 &&
        q.subject === old.subject &&
        q.chapter === old.chapter
      ) {
        return {
          type: "REWORDED_DUPLICATE",
          similarity: sim,
          against: old.id
        };
      }

      if (
        sim >= 0.88 &&
        (
          q.family === old.family ||
          q.topic === old.topic
        )
      ) {
        return {
          type: "NEAR_DUPLICATE",
          similarity: sim,
          against: old.id
        };
      }
    }

    return null;
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        resolve(null);
        return;
      }

      const req =
        indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORE)) {
          const store =
            db.createObjectStore(STORE, {
              keyPath: "id"
            });

          store.createIndex(
            "subject",
            "subject"
          );

          store.createIndex(
            "chapter",
            "chapter"
          );

          store.createIndex(
            "topic",
            "topic"
          );

          store.createIndex(
            "sourceType",
            "sourceType"
          );

          store.createIndex(
            "qualityScore",
            "qualityScore"
          );

          store.createIndex(
            "family",
            "family"
          );
        }
      };

      req.onsuccess = () =>
        resolve(req.result);

      req.onerror = () =>
        reject(req.error);
    });
  }

  async function saveMany(items) {
    const db = await openDB();

    if (!db) {
      try {
        localStorage.setItem(
          MASTER_KEY,
          JSON.stringify(items)
        );
      } catch (_) {}

      return;
    }

    await new Promise((resolve, reject) => {
      const tx =
        db.transaction(
          STORE,
          "readwrite"
        );

      const store =
        tx.objectStore(STORE);

      items.forEach(q => store.put(q));

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll() {
    const db = await openDB();

    if (!db) {
      return jsonLS(MASTER_KEY) || [];
    }

    return new Promise((resolve, reject) => {
      const tx =
        db.transaction(
          STORE,
          "readonly"
        );

      const req =
        tx.objectStore(STORE).getAll();

      req.onsuccess = () =>
        resolve(req.result || []);

      req.onerror = () =>
        reject(req.error);
    });
  }

  async function build(options = {}) {
    const raw = collect();

    const byId = new Map();

    raw.forEach(q => {
      if (!byId.has(q.id)) {
        byId.set(q.id, q);
      }
    });

    const candidates =
      Array.from(byId.values());

    candidates.sort(
      (a, b) =>
        (
          b.qualityScore +
          b.noveltyScore +
          b.learningDensity
        ) -
        (
          a.qualityScore +
          a.noveltyScore +
          a.learningDensity
        )
    );

    const accepted = [];
    const rejected = [];

    const minQuality =
      Number(options.minQuality ?? 35);

    for (const q of candidates) {
      const dup =
        duplicateAgainst(q, accepted);

      if (dup) {
        rejected.push({
          ...q,
          rejectionReason: dup.type,
          duplicateSimilarity:
            dup.similarity,
          duplicateAgainst:
            dup.against
        });

        continue;
      }

      if (
        q.qualityScore < minQuality &&
        !options.allowLowQuality
      ) {
        rejected.push({
          ...q,
          rejectionReason: "LOW_QUALITY"
        });

        continue;
      }

      accepted.push(q);
    }

    await saveMany(accepted);

    const meta = {
      version: "2.0",
      builtAt: Date.now(),

      rawCount: candidates.length,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,

      sources: {
        ranker: candidates.filter(
          q => q.sourceGroup === "ranker"
        ).length,

        pdf: candidates.filter(
          q => q.sourceGroup === "pdf"
        ).length,

        nichod: candidates.filter(
          q => q.sourceGroup === "nichod"
        ).length,

        dpp: candidates.filter(
          q => q.sourceGroup === "dpp"
        ).length,

        ai: candidates.filter(
          q => q.sourceGroup === "ai"
        ).length
      }
    };

    try {
      localStorage.setItem(
        "rankForgeMasterQuestionPoolV2Meta",
        JSON.stringify(meta)
      );

      localStorage.setItem(
        "rankForgeMasterQuestionPoolV2Audit",
        JSON.stringify({
          generatedAt: Date.now(),
          rejected
        })
      );
    } catch (_) {}

    return {
      meta,
      questions: accepted,
      rejected
    };
  }

  async function select(config = {}) {
    let pool = await getAll();

    const match = (value, wanted) =>
      !wanted ||
      !value ||
      norm(value) === norm(wanted);

    pool = pool.filter(q =>
      match(q.subject, config.subject) &&
      match(q.chapter, config.chapter) &&
      match(q.topic, config.topic)
    );

    if (config.difficulty) {
      pool = pool.filter(q =>
        !q.difficulty ||
        norm(q.difficulty)
          .includes(norm(config.difficulty))
      );
    }

    pool.sort(
      (a, b) =>
        (
          b.qualityScore +
          b.noveltyScore +
          b.learningDensity
        ) -
        (
          a.qualityScore +
          a.noveltyScore +
          a.learningDensity
        )
    );

    const count =
      Math.max(1, Number(config.count || 10));

    const selected = [];
    const families = new Set();

    for (const q of pool) {
      if (selected.length >= count) break;

      if (
        families.has(q.family) &&
        selected.length < count * 0.7
      ) {
        continue;
      }

      selected.push(q);
      families.add(q.family);
    }

    return selected;
  }

  async function stats() {
    const pool = await getAll();

    const countBy = field =>
      pool.reduce((out, q) => {
        const k = q[field] || "Unknown";
        out[k] = (out[k] || 0) + 1;
        return out;
      }, {});

    return {
      version: "2.0",
      total: pool.length,
      subjects: countBy("subject"),
      chapters: countBy("chapter"),
      sources: countBy("sourceType"),
      difficulty: countBy("difficulty"),
      averageQuality: pool.length
        ? Math.round(
            pool.reduce(
              (s, q) => s + q.qualityScore,
              0
            ) / pool.length
          )
        : 0
    };
  }

  api.build = build;
  api.select = select;
  api.stats = stats;
  api.getAll = getAll;
  api.collect = collect;

  global.RankForgeMasterPoolV2 = api;

})(window);
