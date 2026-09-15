"use strict";

/*
 PCB NICHOD — verified-content ingestion foundation
 No question is marked verified automatically.
*/

const crypto = require("crypto");

function normalize(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function makeId(q) {
  return crypto
    .createHash("sha256")
    .update([
      q.exam,
      q.year,
      q.subject,
      q.question
    ].map(normalize).join("|"))
    .digest("hex")
    .slice(0, 16);
}

function normalizeQuestion(raw) {
  const q = {
    id: raw.id || "",
    exam: raw.exam || "",
    year: Number(raw.year || 0),
    subject: raw.subject || "",
    chapter: raw.chapter || "",
    topic: raw.topic || "",
    question: raw.question || raw.text || "",
    options: Array.isArray(raw.options) ? raw.options : [],
    answer: raw.answer || raw.correctAnswer || "",
    source: raw.source || "",
    verified: raw.verified === true,
    pyqFamily: raw.pyqFamily || "",
    concepts: Array.isArray(raw.concepts) ? raw.concepts : [],
    relatedConcepts: Array.isArray(raw.relatedConcepts)
      ? raw.relatedConcepts : [],
    prerequisites: Array.isArray(raw.prerequisites)
      ? raw.prerequisites : [],
    traps: Array.isArray(raw.traps) ? raw.traps : [],
    shortcuts: Array.isArray(raw.shortcuts) ? raw.shortcuts : [],
    diamond: raw.diamond === true,
    unseen: raw.unseen === true,
    difficulty: raw.difficulty || "",
    explanation: raw.explanation || ""
  };

  if (!q.id && q.question)
    q.id = makeId(q);

  return q;
}

function validate(q) {
  const errors = [];

  if (!q.id) errors.push("missing id");
  if (!q.question) errors.push("missing question");
  if (!q.subject) errors.push("missing subject");
  if (!q.exam) errors.push("missing exam");

  if (
    q.options.length &&
    !q.answer
  ) {
    errors.push("missing answer");
  }

  return errors;
}

function ingest(records) {
  if (!Array.isArray(records))
    throw new TypeError("Input must be an array");

  const seen = new Set();
  const accepted = [];
  const rejected = [];

  for (const raw of records) {

    const q = normalizeQuestion(raw);
    const errors = validate(q);

    if (seen.has(q.id)) {
      rejected.push({
        question: q,
        errors: ["duplicate id"]
      });
      continue;
    }

    seen.add(q.id);

    if (errors.length) {
      rejected.push({ question: q, errors });
      continue;
    }

    accepted.push(q);
  }

  return {
    accepted,
    rejected,
    stats: {
      input: records.length,
      accepted: accepted.length,
      rejected: rejected.length,
      verified: accepted.filter(q => q.verified).length
    }
  };
}

if (require.main === module) {
  const fs = require("fs");

  const input =
    process.argv[2] ||
    "nichod/imports/pyq.json";

  const output =
    process.argv[3] ||
    "nichod/output/ingested-pyq.json";

  if (!fs.existsSync(input)) {
    console.log("No PYQ input yet:", input);
    process.exit(0);
  }

  const raw = JSON.parse(
    fs.readFileSync(input, "utf8")
  );

  const result = ingest(raw);

  fs.mkdirSync(
    require("path").dirname(output),
    { recursive: true }
  );

  fs.writeFileSync(
    output,
    JSON.stringify(result, null, 2)
  );

  console.log(
    JSON.stringify(result.stats, null, 2)
  );
}

module.exports = {
  normalizeQuestion,
  validate,
  ingest
};
