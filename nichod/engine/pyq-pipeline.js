"use strict";

/*
=========================================================
 PCB NICHOD — PYQ EXTRACTION + CLASSIFICATION PIPELINE
 v1
=========================================================
Input:
  nichod/imports/*.json
  nichod/imports/*.txt

Output:
  nichod/output/pyq-corpus.json
  nichod/output/pyq-report.json

IMPORTANT:
- Does NOT invent PYQs.
- Does NOT mark questions verified automatically.
- Verification remains explicit.
=========================================================
*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "imports");
const OUTPUT = path.join(ROOT, "output");

fs.mkdirSync(INPUT, { recursive: true });
fs.mkdirSync(OUTPUT, { recursive: true });

function norm(v) {
  return String(v ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lower(v) {
  return norm(v).toLowerCase();
}

function idFor(q) {
  return crypto
    .createHash("sha256")
    .update([
      q.exam,
      q.year,
      q.subject,
      q.question
    ].map(lower).join("|"))
    .digest("hex")
    .slice(0, 16);
}

function detectExam(text) {
  const s = lower(text);

  if (/\bneet\b/.test(s))
    return "NEET";

  if (/jee\s*advanced|jee\s*adv/.test(s))
    return "JEE_ADVANCED";

  if (/jee\s*main/.test(s))
    return "JEE_MAIN";

  return "";
}

function detectSubject(text) {
  const s = lower(text);

  if (
    /physics|mechanics|kinematics|electrostatics|current electricity|optics|thermodynamics/.test(s)
  ) return "Physics";

  if (
    /chemistry|organic|inorganic|physical chemistry|mole concept|electrochemistry|thermodynamics|reaction/.test(s)
  ) return "Chemistry";

  if (
    /biology|botany|zoology|genetics|ecology|cell|plant|animal|human physiology/.test(s)
  ) return "Biology";

  return "";
}

function detectDifficulty(text) {
  const s = lower(text);

  if (/very hard|extremely difficult|advanced level/.test(s))
    return "very-hard";

  if (/hard|tough|difficult/.test(s))
    return "hard";

  if (/easy|basic|simple/.test(s))
    return "easy";

  if (/medium|moderate/.test(s))
    return "medium";

  return "";
}

function extractYear(text) {
  const m = norm(text).match(
    /\b(20(?:0\d|1\d|2[0-9]))\b/
  );

  return m ? Number(m[1]) : 0;
}

function splitQuestions(text) {

  text = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");

  /*
    Supports common numbered formats:
      1.
      1)
      Q1.
      Question 1
  */

  const parts = text.split(
    /(?=(?:^|\n)\s*(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\):\-])/im
  );

  return parts
    .map(norm)
    .filter(x => x.length >= 20);
}

function extractOptions(block) {

  const matches = [
    ...block.matchAll(
      /(?:^|\s)(?:\(?([A-D])\)?[\.\):\-])\s*([^()]+?)(?=\s+(?:\(?[A-D]\)?[\.\):\-])|$)/gi
    )
  ];

  return matches
    .map(m => norm(m[2]))
    .filter(Boolean)
    .slice(0, 4);
}

function cleanQuestion(block) {

  let q = block
    .replace(
      /^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\):\-]\s*/i,
      ""
    );

  q = q
    .replace(
      /(?:\(?[A-D]\)?[\.\):\-]\s*.+)$/i,
      ""
    );

  return norm(q);
}

function conceptCandidates(q) {

  const s = lower(
    [
      q.question,
      q.chapter,
      q.topic
    ].join(" ")
  );

  const result = [];

  const rules = {
    "Newton Laws": /newton|force|friction|inertia/,
    "Work Energy Power": /work|energy|power/,
    "Current Electricity": /current|resistance|kirchhoff|ohm/,
    "Electrostatics": /charge|electric field|potential|capacitor/,
    "Ray Optics": /lens|mirror|refraction|reflection/,
    "Chemical Bonding": /bond|hybridization|vsepr|molecular/,
    "Electrochemistry": /electrolysis|cell potential|nernst/,
    "Organic Reactions": /reagent|mechanism|reaction|product/,
    "Genetics": /gene|allele|inheritance|cross|dna|rna/,
    "Cell Biology": /cell|organelle|membrane|mitochondria/,
    "Human Physiology": /blood|heart|kidney|neuron|hormone/,
    "Ecology": /ecosystem|population|community|biodiversity/
  };

  for (const [name, rx] of Object.entries(rules)) {
    if (rx.test(s))
      result.push(name);
  }

  return result;
}

function trapCandidates(q) {

  const s = lower(q.question);

  const traps = [];

  if (
    /\bnot\b|\bincorrect\b|\bfalse\b|\bexcept\b|\bwrong\b/.test(s)
  )
    traps.push("negative-statement-trap");

  if (
    /approximately|nearest|roughly/.test(s)
  )
    traps.push("approximation-trap");

  if (
    /unit|dimension|sign|direction|magnitude/.test(s)
  )
    traps.push("unit-sign-direction-trap");

  if (
    /statement|statements|assertion/.test(s)
  )
    traps.push("statement-trap");

  return traps;
}

function shortcutCandidates(q) {

  const s = lower(q.question);
  const out = [];

  if (
    /ratio|proportional|percentage|percent/.test(s)
  )
    out.push("ratio-first");

  if (
    /graph|slope|area under/.test(s)
  )
    out.push("graph-recognition");

  if (
    /approximate|estimate|nearest/.test(s)
  )
    out.push("estimation");

  if (
    /symmetry|symmetric/.test(s)
  )
    out.push("symmetry-recognition");

  if (
    /conservation/.test(s)
  )
    out.push("conservation-law-first");

  return out;
}

function familyKey(q) {

  const concept =
    q.concepts[0] ||
    q.topic ||
    q.chapter ||
    "unclassified";

  const trap =
    q.traps[0] ||
    "none";

  return [
    q.subject,
    concept,
    trap
  ]
    .map(lower)
    .join("|");
}

function diamondScore(q) {

  let score = 0;

  if (q.concepts.length >= 1)
    score += 20;

  if (q.traps.length)
    score += 20;

  if (q.shortcuts.length)
    score += 15;

  if (q.options.length >= 4)
    score += 10;

  if (
    q.exam === "NEET" ||
    q.exam === "JEE_MAIN" ||
    q.exam === "JEE_ADVANCED"
  )
    score += 10;

  if (q.difficulty === "hard")
    score += 15;

  if (q.difficulty === "very-hard")
    score += 20;

  return Math.min(score, 100);
}

function parseRaw(raw, source) {

  if (Array.isArray(raw))
    return raw;

  if (raw && Array.isArray(raw.questions))
    return raw.questions;

  if (raw && Array.isArray(raw.data))
    return raw.data;

  if (raw && Array.isArray(raw.items))
    return raw.items;

  return [{
    question: String(raw ?? ""),
    source
  }];
}

function normalizeRaw(raw, source) {

  const text =
    norm(
      raw.question ||
      raw.text ||
      raw.prompt ||
      ""
    );

  const q = {
    id: raw.id || "",
    exam:
      raw.exam ||
      detectExam(
        [source, text].join(" ")
      ),
    year:
      Number(raw.year || 0) ||
      extractYear(source),
    subject:
      raw.subject ||
      detectSubject(
        [source, text].join(" ")
      ),
    chapter:
      norm(raw.chapter),
    topic:
      norm(raw.topic),
    question: text,
    options:
      Array.isArray(raw.options)
        ? raw.options.map(norm).filter(Boolean)
        : extractOptions(text),
    answer:
      norm(
        raw.answer ||
        raw.correctAnswer ||
        ""
      ),
    source,
    verified:
      raw.verified === true,
    concepts:
      Array.isArray(raw.concepts)
        ? raw.concepts
        : [],
    relatedConcepts: [],
    prerequisites: [],
    traps: [],
    shortcuts: [],
    diamond: false,
    diamondScore: 0,
    unseen: false,
    difficulty:
      raw.difficulty ||
      detectDifficulty(text),
    explanation:
      norm(
        raw.explanation ||
        raw.solution ||
        ""
      )
  };

  if (!q.question)
    return null;

  if (!q.concepts.length)
    q.concepts = conceptCandidates(q);

  q.traps = trapCandidates(q);

  q.shortcuts =
    shortcutCandidates(q);

  q.pyqFamily =
    familyKey(q);

  q.diamondScore =
    diamondScore(q);

  /*
    Diamond is only a CANDIDATE.
    Human/content verification can promote it.
  */

  q.diamond =
    q.diamondScore >= 60 &&
    q.verified === true;

  if (!q.id)
    q.id = idFor(q);

  return q;
}

function ingestFile(file) {

  const full =
    path.join(INPUT, file);

  const ext =
    path.extname(file).toLowerCase();

  if (ext === ".json") {

    const raw =
      JSON.parse(
        fs.readFileSync(full, "utf8")
      );

    return parseRaw(
      raw,
      file
    )
      .map(x =>
        normalizeRaw(x, file)
      )
      .filter(Boolean);
  }

  if (ext === ".txt") {

    const text =
      fs.readFileSync(
        full,
        "utf8"
      );

    return splitQuestions(text)
      .map(block =>
        normalizeRaw(
          {
            question: cleanQuestion(block)
          },
          file
        )
      )
      .filter(Boolean);
  }

  return [];
}

function dedupe(records) {

  const seen = new Set();
  const out = [];

  for (const q of records) {

    const key =
      lower(
        q.id ||
        q.question
      );

    if (!key || seen.has(key))
      continue;

    seen.add(key);
    out.push(q);
  }

  return out;
}

function buildReport(records) {

  const subjects = {};
  const exams = {};
  const families = {};

  for (const q of records) {

    subjects[q.subject] =
      (subjects[q.subject] || 0) + 1;

    exams[q.exam] =
      (exams[q.exam] || 0) + 1;

    families[q.pyqFamily] =
      (families[q.pyqFamily] || 0) + 1;
  }

  return {
    version: "PCB-NICHOD-PYQ-PIPELINE-1.0",
    generatedAt:
      new Date().toISOString(),
    total: records.length,
    verified:
      records.filter(q => q.verified).length,
    diamondCandidates:
      records.filter(
        q => q.diamondScore >= 60
      ).length,
    promotedDiamonds:
      records.filter(
        q => q.diamond === true
      ).length,
    subjects,
    exams,
    familyCount:
      Object.keys(families).length,
    topFamilies:
      Object.entries(families)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 50)
        .map(([family,count]) => ({
          family,
          count
        }))
  };
}

function main() {

  const files =
    fs.readdirSync(INPUT)
      .filter(f =>
        /\.(json|txt)$/i.test(f)
      );

  if (!files.length) {

    console.log(
      "No PYQ .json/.txt files found."
    );

    console.log(
      "Put verified/source PYQ data inside:"
    );

    console.log(
      INPUT
    );

    return;
  }

  let records = [];

  for (const file of files) {

    try {

      const rows =
        ingestFile(file);

      records.push(...rows);

      console.log(
        `${file}: ${rows.length} records`
      );

    } catch (err) {

      console.error(
        `${file}: ${err.message}`
      );
    }
  }

  records =
    dedupe(records);

  const report =
    buildReport(records);

  fs.writeFileSync(
    path.join(
      OUTPUT,
      "pyq-corpus.json"
    ),
    JSON.stringify(
      records,
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(
      OUTPUT,
      "pyq-report.json"
    ),
    JSON.stringify(
      report,
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );
}

if (require.main === module)
  main();

module.exports = {
  normalizeRaw,
  splitQuestions,
  conceptCandidates,
  trapCandidates,
  shortcutCandidates,
  familyKey,
  diamondScore,
  ingestFile,
  dedupe,
  buildReport
};
