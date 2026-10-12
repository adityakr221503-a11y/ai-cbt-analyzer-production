"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const requiredFiles = [
  "pdf-to-cbt.v317.html",
  "rankers-test-series.html",
  "cbt.html",

  "nichod/engine/nichod-ingest.js",
  "nichod/engine/pyq-pipeline.js",
  "nichod/engine/pdf-nichod-bridge.js",
  "nichod/engine/nichod-ranker-feed.js",
  "nichod/engine/nichod-unseen-generator.js",
  "nichod/engine/nichod-generation-bridge.js",
  "nichod/engine/nichod-review-ui.js",
  "nichod/engine/nichod-authoring-engine.js",
  "nichod/engine/nichod-authoring-ui.js",
  "nichod/engine/nichod-verified-feed.js",
  "nichod/engine/nichod-cbt-metadata-bridge.js",
  "nichod/engine/nichod-posttest-bridge.js",
  "nichod/engine/nichod-unified-orchestrator.js",
  "nichod/engine/nichod-system-health.js",
  "nichod/engine/nichod-runtime-test.js",
  "nichod/engine/nichod-e2e-harness.js"
];

const htmlFiles = [
  "pdf-to-cbt.v317.html",
  "rankers-test-series.html",
  "cbt.html"
];

const results = [];

function pass(name, detail = "") {
  results.push({
    name,
    status: "PASS",
    detail
  });
}

function fail(name, detail = "") {
  results.push({
    name,
    status: "FAIL",
    detail
  });
}

function check(name, condition, detail = "") {
  condition
    ? pass(name, detail)
    : fail(name, detail);
}

function read(file) {
  return fs.readFileSync(
    path.join(ROOT, file),
    "utf8"
  );
}

/*
====================================================
1. REQUIRED FILES
====================================================
*/

for (const file of requiredFiles) {

  check(
    "FILE " + file,
    fs.existsSync(
      path.join(ROOT, file)
    )
  );

}

/*
====================================================
2. JAVASCRIPT SYNTAX
====================================================
*/

const jsFiles = requiredFiles.filter(
  file => file.endsWith(".js")
);

for (const file of jsFiles) {

  try {

    require("child_process").execFileSync(
      "node",
      ["--check", file],
      {
        stdio: "ignore"
      }
    );

    pass(
      "SYNTAX " + file
    );

  } catch (_) {

    fail(
      "SYNTAX " + file
    );

  }

}

/*
====================================================
3. PDF PIPELINE
====================================================
*/

let pdfHTML = "";

try {
  pdfHTML =
    read("pdf-to-cbt.v317.html");
} catch (_) {}

check(
  "PDF.js local vendor",
  pdfHTML.includes(
    "./vendor/pdf.min.js"
  )
);

check(
  "PDF storage key",
  pdfHTML.includes(
    "pdfCbtQuestions"
  )
);

check(
  "PDF NICHOD bridge",
  pdfHTML.includes(
    "pdf-nichod-bridge.js"
  )
);

check(
  "PDF unified orchestrator",
  pdfHTML.includes(
    "nichod-unified-orchestrator.js"
  )
);

check(
  "PDF health monitor",
  pdfHTML.includes(
    "nichod-system-health.js"
  )
);

check(
  "PDF E2E harness",
  pdfHTML.includes(
    "nichod-e2e-harness.js"
  )
);

/*
====================================================
4. RANKER PIPELINE
====================================================
*/

let rankerHTML = "";

try {
  rankerHTML =
    read("rankers-test-series.html");
} catch (_) {}

const rankerScripts = [
  "question-bank.js",
  "import-test180.js",
  "ranker-v11-real-lifecycle.js",
  "cbt-unified-core.js",
  "pcb-nichod-ranker.js",
  "nichod-ranker-feed.js",
  "nichod-unseen-generator.js",
  "nichod-generation-bridge.js",
  "nichod-review-ui.js",
  "nichod-authoring-engine.js",
  "nichod-authoring-ui.js",
  "nichod-verified-feed.js",
  "nichod-cbt-metadata-bridge.js",
  "nichod-posttest-bridge.js",
  "nichod-unified-orchestrator.js",
  "nichod-system-health.js",
  "nichod-e2e-harness.js"
];

for (const script of rankerScripts) {

  check(
    "RANKER " + script,
    rankerHTML.includes(script)
  );

}

check(
  "Ranker selection storage",
  rankerHTML.includes(
    "rbSelectedQuestions"
  )
);

check(
  "Ranker CBT source",
  rankerHTML.includes(
    "CBT_ACTIVE_SOURCE"
  )
);

/*
====================================================
5. CBT PIPELINE
====================================================
*/

let cbtHTML = "";

try {
  cbtHTML =
    read("cbt.html");
} catch (_) {}

const cbtScripts = [
  "nichod-cbt-metadata-bridge.js",
  "nichod-posttest-bridge.js",
  "nichod-unified-orchestrator.js",
  "nichod-system-health.js",
  "nichod-e2e-harness.js"
];

for (const script of cbtScripts) {

  check(
    "CBT " + script,
    cbtHTML.includes(script)
  );

}

check(
  "CBT history",
  cbtHTML.includes(
    "cbtHistory"
  )
);

/*
====================================================
6. CROSS-PAGE PATH VALIDATION
====================================================
*/

for (const file of htmlFiles) {

  let html = "";

  try {
    html = read(file);
  } catch (_) {
    continue;
  }

  const refs =
    [...html.matchAll(
      /<script[^>]+src=["']([^"']+)["']/gi
    )]
    .map(x => x[1])
    .filter(x =>
      !x.startsWith("http://") &&
      !x.startsWith("https://") &&
      !x.startsWith("data:")
    );

  for (const ref of refs) {

    const clean =
      ref.split("?")[0];

    const target =
      path.normalize(
        path.join(
          path.dirname(file),
          clean
        )
      );

    check(
      "REF " + file + " -> " + clean,
      fs.existsSync(
        path.join(ROOT, target)
      ),
      target
    );

  }

}

/*
====================================================
7. NICHOD DATA DIRECTORIES
====================================================
*/

check(
  "NICHOD schema",
  fs.existsSync(
    "nichod/data/schema.json"
  )
);

check(
  "NICHOD imports directory",
  fs.existsSync(
    "nichod/imports"
  )
);

check(
  "Runtime health report",
  fs.existsSync(
    "nichod/data/runtime-health-report.json"
  )
);

/*
====================================================
8. REPORT
====================================================
*/

const passed =
  results.filter(
    x => x.status === "PASS"
  ).length;

const failed =
  results.filter(
    x => x.status === "FAIL"
  ).length;

const report = {

  version: 2,

  generatedAt:
    new Date().toISOString(),

  repository:
    "ai-cbt-analyzer-production",

  pipeline: [
    "PDF",
    "NICHOD",
    "Ranker",
    "CBT",
    "Result",
    "Mistake Bank",
    "Mentor",
    "Adaptive Next Test"
  ],

  passed,
  failed,

  total:
    results.length,

  status:
    failed === 0
      ? "PASS"
      : "ATTENTION",

  results

};

fs.mkdirSync(
  "nichod/data",
  {
    recursive: true
  }
);

fs.writeFileSync(
  "nichod/data/final-validation-report.json",
  JSON.stringify(
    report,
    null,
    2
  )
);

console.log(
  "\n=========================================="
);

console.log(
  " PCB NICHOD FINAL PIPELINE VALIDATION"
);

console.log(
  "=========================================="
);

console.log(
  "STATUS:",
  report.status
);

console.log(
  "PASS:",
  passed
);

console.log(
  "FAIL:",
  failed
);

console.log(
  "TOTAL:",
  results.length
);

console.log(
  "REPORT: nichod/data/final-validation-report.json"
);

console.log(
  "==========================================\n"
);

if (failed > 0) {

  console.log(
    "FAILED CHECKS:"
  );

  results
    .filter(
      x => x.status === "FAIL"
    )
    .forEach(
      x =>
        console.log(
          "❌",
          x.name,
          x.detail
            ? "— " + x.detail
            : ""
        )
    );

  process.exitCode = 1;

} else {

  console.log(
    "✅ ALL STATIC PIPELINE CHECKS PASSED"
  );

}
