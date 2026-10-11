/*
 * RankForge AI Question Engine
 * Local/offline-first question intelligence layer.
 * No external API required.
 */
(function (global) {
  "use strict";

  const RF_AI_VERSION = "1.0.0";

  const SUBJECTS = ["Physics", "Chemistry", "Biology"];

  const DIFFICULTIES = ["NEET", "NEET+", "JEE Main", "JEE Advanced"];

  const TRAP_TYPES = [
    "Concept Trap",
    "Calculation Trap",
    "NCERT Precision",
    "Statement Trap",
    "Comparison Trap",
    "Application Trap",
    "Unit Trap",
    "Sign Trap",
    "Graph Trap",
    "Exception Trap",
    "Multi-Concept",
    "Time Pressure"
  ];

  function clean(v) {
    return String(v == null ? "" : v)
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(str) {
    let h = 2166136261;
    str = String(str || "");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }

  function normalizeOptions(q) {
    const raw =
      q.options ||
      q.choices ||
      q.answers ||
      [];

    if (Array.isArray(raw)) {
      return raw.map(clean).filter(Boolean);
    }

    if (raw && typeof raw === "object") {
      return Object.keys(raw)
        .sort()
        .map(k => clean(raw[k]))
        .filter(Boolean);
    }

    return [];
  }

  function normalizeCorrect(q, options) {
    let c =
      q.correctAnswer ??
      q.correct ??
      q.answer ??
      q.correctOption ??
      q.correctIndex;

    if (typeof c === "number") {
      if (c >= 0 && c < options.length) return c;
      if (c >= 1 && c <= options.length) return c - 1;
    }

    c = clean(c);

    if (!c) return -1;

    const idx = options.findIndex(
      x => x.toLowerCase() === c.toLowerCase()
    );

    if (idx >= 0) return idx;

    const letter = String(c ?? "").toUpperCase().match(/^[A-D]$/);
    if (letter) return letter.charCodeAt(0) - 65;

    const number = Number(c);
    if (Number.isFinite(number)) {
      if (number >= 0 && number < options.length) return number;
      if (number >= 1 && number <= options.length) return number - 1;
    }

    return -1;
  }

  function inferSubject(q) {
    const s = clean(q.subject || q.section || q.sub || "");
    if (/bio/i.test(s)) return "Biology";
    if (/chem/i.test(s)) return "Chemistry";
    if (/phys/i.test(s)) return "Physics";

    const t = clean(
      q.text ||
      q.question ||
      q.questionText ||
      ""
    ).toLowerCase();

    if (
      /mitochond|ribosome|gene|dna|rna|plant|animal|ecology|cell|enzyme|hormone|botany|zoology/.test(t)
    ) return "Biology";

    if (
      /mole|molar|organic|inorganic|oxidation|reduction|enthalpy|equilibrium|benzene|reaction|periodic/.test(t)
    ) return "Chemistry";

    if (
      /velocity|acceleration|force|momentum|current|voltage|resistance|lens|mirror|frequency|wavelength|magnetic|electric|energy|power/.test(t)
    ) return "Physics";

    return "Unknown";
  }

  function inferTrap(q) {
    const t = clean(
      q.trapType ||
      q.trap ||
      q.reason ||
      ""
    );

    if (t) return t;

    const text = clean(
      q.text ||
      q.question ||
      q.questionText ||
      ""
    ).toLowerCase();

    if (/incorrect|correct|statement|consider the following/.test(text))
      return "Statement Trap";

    if (/except|not true|false/.test(text))
      return "Exception Trap";

    if (/unit|dimension|dimensional/.test(text))
      return "Unit Trap";

    if (/graph|figure|plot|curve/.test(text))
      return "Graph Trap";

    if (/compare|greater|smaller|maximum|minimum|ratio/.test(text))
      return "Comparison Trap";

    if (/[0-9].*[=+\-*/]|calculate|find the value|numerical/.test(text))
      return "Calculation Trap";

    return "Concept Trap";
  }

  function inferDifficulty(q) {
    const explicit = clean(q.difficulty || q.level || "");
    if (explicit) return explicit;

    const text = clean(
      q.text ||
      q.question ||
      q.questionText ||
      ""
    );

    const concepts = (text.match(/\b(and|also|whereas|while|because|therefore)\b/gi) || []).length;

    if (text.length > 450 || concepts >= 3)
      return "NEET+";

    if (text.length > 250)
      return "NEET";

    return "NEET";
  }

  function normalize(q, index) {
    q = q || {};

    const text = clean(
      q.text ||
      q.question ||
      q.questionText ||
      q.prompt
    );

    const options = normalizeOptions(q);
    const correctIndex = normalizeCorrect(q, options);

    const subject = inferSubject(q);
    const trapType = inferTrap(q);
    const difficulty = inferDifficulty(q);

    const id =
      clean(q.id || q.questionId) ||
      "RF-" + hash(text + "|" + options.join("|"));

    return {
      ...q,
      id,
      text,
      question: text,
      options,
      correctIndex,
      correctAnswer:
        correctIndex >= 0
          ? options[correctIndex]
          : clean(q.correctAnswer || q.answer || ""),
      subject,
      trapType,
      difficulty,
      source: clean(q.source || "RankForge"),
      index
    };
  }

  function validate(q) {
    return !!(
      q &&
      clean(q.text).length >= 10 &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.correctIndex >= 0 &&
      q.correctIndex < q.options.length
    );
  }

  function fingerprint(q) {
    const text = clean(q.text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");

    const opts = q.options
      .map(x =>
        clean(x)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
      )
      .join("|");

    return hash(text + "||" + opts);
  }

  function noveltyScore(q, pool) {
    pool = Array.isArray(pool) ? pool : [];

    if (!pool.length) return 100;

    const fp = fingerprint(q);

    if (pool.some(x => fingerprint(x) === fp))
      return 0;

    const words = new Set(
      clean(q.text)
        .toLowerCase()
        .split(/\W+/)
        .filter(x => x.length > 3)
    );

    let best = 0;

    pool.slice(0, 5000).forEach(x => {
      const other = new Set(
        clean(x.text)
          .toLowerCase()
          .split(/\W+/)
          .filter(w => w.length > 3)
      );

      let common = 0;

      words.forEach(w => {
        if (other.has(w)) common++;
      });

      const union = new Set([...words, ...other]).size;

      if (union) {
        best = Math.max(best, common / union);
      }
    });

    return Math.max(0, Math.round((1 - best) * 100));
  }

  function score(q, pool) {
    let score = 50;

    if (q.subject !== "Unknown") score += 5;
    if (q.options.length === 4) score += 5;
    if (q.correctIndex >= 0) score += 10;

    const text = q.text.toLowerCase();

    if (text.length >= 120) score += 5;
    if (q.trapType && q.trapType !== "Concept Trap") score += 5;

    const novelty = noveltyScore(q, pool);
    score += Math.round(novelty * 0.15);

    return Math.min(100, score);
  }

  function analyzeQuestion(q, pool) {
    const n = normalize(q, 0);

    return {
      ...n,
      fingerprint: fingerprint(n),
      noveltyScore: noveltyScore(n, pool),
      learningDensityScore:
        Math.min(
          100,
          35 +
          (n.trapType !== "Concept Trap" ? 15 : 0) +
          (n.text.length > 180 ? 15 : 0) +
          (n.options.length === 4 ? 10 : 0)
        ),
      qualityScore: score(n, pool)
    };
  }

  function deduplicate(questions) {
    const seen = new Set();
    const out = [];

    (questions || []).forEach((q, i) => {
      const n = normalize(q, i);
      const fp = fingerprint(n);

      if (!seen.has(fp)) {
        seen.add(fp);
        out.push(n);
      }
    });

    return out;
  }

  function buildBlueprint(config) {
    config = config || {};

    const count = Number(config.count) || 20;
    const subject = config.subject || "Mixed";
    const difficulty = config.difficulty || "NEET+";

    return {
      id: "RF-BLUEPRINT-" + Date.now(),
      title:
        config.title ||
        "RankForge AI Challenge",
      subject,
      difficulty,
      count,
      negativeMarking:
        config.negativeMarking !== false,
      trapMix: {
        "Concept Trap": 20,
        "Application Trap": 15,
        "Comparison Trap": 10,
        "Statement Trap": 15,
        "Calculation Trap": 15,
        "NCERT Precision": 15,
        "Multi-Concept": 10
      },
      generatedAt: new Date().toISOString()
    };
  }

  function selectFromPool(pool, config) {
    config = config || {};
    const count = Number(config.count) || 20;

    let items = deduplicate(pool || []);

    if (config.subject && config.subject !== "Mixed") {
      items = items.filter(
        q => q.subject === config.subject
      );
    }

    if (config.difficulty) {
      const d = String(config.difficulty).toLowerCase();

      const filtered = items.filter(
        q => String(q.difficulty).toLowerCase() === d
      );

      if (filtered.length >= Math.min(count, 5))
        items = filtered;
    }

    items = items
      .map(q => analyzeQuestion(q, pool))
      .sort(
        (a, b) =>
          b.qualityScore - a.qualityScore ||
          b.noveltyScore - a.noveltyScore
      );

    return items.slice(0, count);
  }

  function createTest(pool, config) {
    const blueprint = buildBlueprint(config);
    const questions = selectFromPool(pool, blueprint);

    return {
      id: "RF-AI-TEST-" + Date.now(),
      title: blueprint.title,
      source: "RankForge AI",
      blueprint,
      questions,
      questionCount: questions.length,
      createdAt: new Date().toISOString()
    };
  }

  const API = {
    version: RF_AI_VERSION,
    subjects: SUBJECTS,
    difficulties: DIFFICULTIES,
    trapTypes: TRAP_TYPES,
    normalize,
    validate,
    deduplicate,
    fingerprint,
    noveltyScore,
    analyzeQuestion,
    buildBlueprint,
    selectFromPool,
    createTest
  };

  global.RankForgeAI = API;

})(window);
