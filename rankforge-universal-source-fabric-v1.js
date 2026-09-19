(function () {
  "use strict";

  const VERSION = "RANKFORGE_UNIVERSAL_SOURCE_FABRIC_V1";
  const ENGINE = () => window.RankForgeSourceEngine || null;
  const MASTER = () => window.RankForgeMasterPoolV2 || null;

  const SOURCES = Object.freeze([
    "owner-pdf-v6",
    "owner-json",
    "owner-jsonl",
    "owner-ndjson",
    "qti",
    "licensed-api",
    "rankforge-ai"
  ]);

  function clean(v) {
    return String(v == null ? "" : v)
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(s) {
    let h = 2166136261;
    s = String(s || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }

  function normalize(raw, meta = {}) {
    const q = raw || {};
    const options = Array.isArray(q.options)
      ? q.options.map(clean).filter(Boolean)
      : Array.isArray(q.choices)
        ? q.choices.map(x => clean(typeof x === "object" ? (x.text || x.label) : x)).filter(Boolean)
        : [];

    const text = clean(q.question || q.text || q.prompt || q.stem);
    const answer =
      q.correctAnswer ??
      q.correct ??
      q.answer ??
      q.correctIndex ??
      null;

    return {
      ...q,
      id: clean(q.id) || ("RF-" + hash(text + "|" + options.join("|"))),
      question: text,
      options,
      correctAnswer: answer,
      sourceType: meta.sourceType || q.sourceType || "unknown",
      sourceId: meta.sourceId || q.sourceId || "",
      license: meta.license || q.license || "",
      provenance: meta.provenance || q.provenance || "",
      importedAt: q.importedAt || new Date().toISOString(),
      schemaVersion: "RFQ-V1"
    };
  }

  function validate(q) {
    const errors = [];
    if (!q.question || q.question.length < 8) errors.push("INVALID_STEM");
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push("INVALID_OPTIONS");
    if (q.correctAnswer === null || q.correctAnswer === undefined || q.correctAnswer === "")
      errors.push("MISSING_ANSWER");
    return { valid: errors.length === 0, errors };
  }

  function detectFormat(name, text) {
    const n = String(name || "").toLowerCase();
    const t = String(text || "").trim();
    if (n.endsWith(".jsonl") || n.endsWith(".ndjson")) return "jsonl";
    if (n.endsWith(".json")) return "json";
    if (n.endsWith(".xml") || t.startsWith("<")) return "qti/xml";
    if (n.endsWith(".pdf")) return "pdf-v6";
    return "unknown";
  }

  function parseJSONL(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean)
      .map((x, i) => {
        try { return JSON.parse(x); }
        catch (_) { return { __parseError: true, __line: i + 1, raw: x }; }
      });
  }

  function parse(input, meta = {}) {
    let rows = [];

    if (Array.isArray(input)) rows = input;
    else if (typeof input === "object" && input) {
      rows = Array.isArray(input.questions)
        ? input.questions
        : Array.isArray(input.items)
          ? input.items
          : [input];
    } else {
      const text = String(input || "").trim();
      rows = text.split(/\r?\n/).length > 1
        ? parseJSONL(text)
        : [JSON.parse(text)];
    }

    const normalized = [];
    const rejected = [];

    for (const raw of rows) {
      if (raw && raw.__parseError) {
        rejected.push({ raw, errors: ["PARSE_ERROR"] });
        continue;
      }

      const q = normalize(raw, meta);
      const check = validate(q);

      if (check.valid) normalized.push(q);
      else rejected.push({ question: q, errors: check.errors });
    }

    return { normalized, rejected };
  }

  async function ingest(input, meta = {}) {
    const parsed = parse(input, meta);
    const engine = ENGINE();

    if (!engine) {
      return {
        ok: false,
        persisted: false,
        reason: "SOURCE_ENGINE_UNAVAILABLE",
        ...parsed
      };
    }

    let result;
    if (meta.sourceType === "rankforge-ai" && engine.submitAIQuestions) {
      result = await engine.submitAIQuestions(parsed.normalized, meta);
    } else if (engine.submitModuleQuestions) {
      result = await engine.submitModuleQuestions(parsed.normalized, meta);
    }

    return {
      ok: true,
      persisted: !!result,
      sourceType: meta.sourceType || "unknown",
      accepted: parsed.normalized.length,
      rejected: parsed.rejected.length,
      result
    };
  }

  function health() {
    return {
      version: VERSION,
      sourceEngine: !!ENGINE(),
      masterPool: !!MASTER(),
      pdfV6: !!window.RankForgeOwnerPDFExtractionEngineV6,
      sources: SOURCES.slice(),
      singleCanonicalPipeline: true,
      answerGuessing: false,
      parallelQuestionDatabase: false
    };
  }

  window.RankForgeUniversalSourceFabric = {
    version: VERSION,
    sources: SOURCES,
    clean,
    hash,
    normalize,
    validate,
    detectFormat,
    parse,
    ingest,
    health
  };
})();
