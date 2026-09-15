"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const REPORT = path.join(
  ROOT,
  "nichod",
  "data",
  "runtime-health-report.json"
);

const FILES = [
  "cbt.html",
  "pdf-to-cbt.v317.html",
  "rankers-test-series.html",
  "nichod/engine/nichod-unified-orchestrator.js",
  "nichod/engine/nichod-system-health.js",
  "nichod/engine/pdf-nichod-bridge.js",
  "nichod/engine/nichod-ranker-feed.js",
  "nichod/engine/nichod-unseen-generator.js",
  "nichod/engine/nichod-generation-bridge.js",
  "nichod/engine/nichod-review-ui.js",
  "nichod/engine/nichod-authoring-engine.js",
  "nichod/engine/nichod-authoring-ui.js",
  "nichod/engine/nichod-verified-feed.js",
  "nichod/engine/nichod-cbt-metadata-bridge.js",
  "nichod/engine/nichod-posttest-bridge.js"
];

const SUBJECTS = [
  "Physics",
  "Chemistry",
  "Biology"
];

function exists(file) {
  return fs.existsSync(
    path.join(ROOT, file)
  );
}

function read(file) {
  return fs.readFileSync(
    path.join(ROOT, file),
    "utf8"
  );
}

function checkFile(file) {
  return {
    file,
    exists: exists(file),
    size: exists(file)
      ? fs.statSync(
          path.join(ROOT, file)
        ).size
      : 0
  };
}

function checkScriptReferences() {

  const pages = [
    "cbt.html",
    "pdf-to-cbt.v317.html",
    "rankers-test-series.html"
  ];

  const result = {};

  for (const page of pages) {

    if (!exists(page)) {
      result[page] = {
        exists: false
      };
      continue;
    }

    const text = read(page);

    result[page] = {
      exists: true,

      unified:
        text.includes(
          "nichod-unified-orchestrator.js"
        ),

      health:
        text.includes(
          "nichod-system-health.js"
        ),

      pdfBridge:
        text.includes(
          "pdf-nichod-bridge.js"
        ),

      rankerFeed:
        text.includes(
          "nichod-ranker-feed.js"
        ),

      unseen:
        text.includes(
          "nichod-unseen-generator.js"
        ),

      generation:
        text.includes(
          "nichod-generation-bridge.js"
        ),

      review:
        text.includes(
          "nichod-review-ui.js"
        ),

      authoring:
        text.includes(
          "nichod-authoring-engine.js"
        ),

      authoringUI:
        text.includes(
          "nichod-authoring-ui.js"
        ),

      verified:
        text.includes(
          "nichod-verified-feed.js"
        ),

      metadata:
        text.includes(
          "nichod-cbt-metadata-bridge.js"
        ),

      postTest:
        text.includes(
          "nichod-posttest-bridge.js"
        )
    };
  }

  return result;
}

function checkJS() {

  const files = FILES.filter(
    file =>
      file.endsWith(".js") &&
      exists(file)
  );

  const results = [];

  for (const file of files) {

    let passed = false;
    let error = null;

    try {

      require("child_process")
        .execFileSync(
          "node",
          ["--check", file],
          {
            cwd: ROOT,
            stdio: "pipe"
          }
        );

      passed = true;

    } catch (e) {

      error =
        String(
          e.stderr ||
          e.message ||
          e
        ).trim();

    }

    results.push({
      file,
      passed,
      error
    });
  }

  return results;
}

function inspectHTMLScripts() {

  const pages = [
    "cbt.html",
    "pdf-to-cbt.v317.html",
    "rankers-test-series.html"
  ];

  const result = {};

  for (const page of pages) {

    if (!exists(page))
      continue;

    const text = read(page);

    const scripts =
      [
        ...text.matchAll(
          /<script[^>]+src=["']([^"']+)["']/gi
        )
      ]
      .map(
        m => m[1]
      );

    result[page] = {

      totalScripts:
        scripts.length,

      nichodScripts:
        scripts.filter(
          x =>
            x.toLowerCase()
             .includes("nichod")
        ),

      missingLocalScripts:
        scripts
          .filter(
            x =>
              x.startsWith("./") &&
              x.endsWith(".js")
          )
          .filter(
            x => {

              const clean =
                x.split("?")[0]
                  .replace(
                    /^\.\//,
                    ""
                  );

              return !exists(clean);

            }
          )

    };
  }

  return result;
}

function subjectCoverage() {

  const files = [
    "test180-questions.json",
    "test180-questions.js"
  ];

  const output = {};

  for (const file of files) {

    if (!exists(file)) {
      output[file] = {
        exists: false
      };
      continue;
    }

    const text =
      read(file).toLowerCase();

    output[file] = {

      exists: true,

      Physics:
        text.includes("physics"),

      Chemistry:
        text.includes("chemistry"),

      Biology:
        text.includes("biology")

    };
  }

  return output;
}

function gitState() {

  const cp =
    require("child_process");

  function run(args) {

    try {

      return cp
        .execFileSync(
          "git",
          args,
          {
            cwd: ROOT,
            encoding: "utf8"
          }
        )
        .trim();

    } catch (_) {

      return null;

    }
  }

  return {

    branch:
      run([
        "branch",
        "--show-current"
      ]),

    commit:
      run([
        "log",
        "-1",
        "--oneline"
      ]),

    status:
      run([
        "status",
        "--short"
      ])

  };
}

function buildReport() {

  const files =
    FILES.map(
      checkFile
    );

  const js =
    checkJS();

  const refs =
    checkScriptReferences();

  const html =
    inspectHTMLScripts();

  const subjects =
    subjectCoverage();

  const missingFiles =
    files
      .filter(
        x => !x.exists
      )
      .map(
        x => x.file
      );

  const syntaxFailures =
    js
      .filter(
        x => !x.passed
      );

  const missingReferences =
    Object.entries(
      html
    )
      .flatMap(
        ([page, data]) =>
          data.missingLocalScripts
            .map(
              file => ({
                page,
                file
              })
            )
      );

  return {

    version: 1,

    generatedAt:
      new Date().toISOString(),

    project:
      "PCB NICHOD",

    pipeline: [
      "PDF",
      "NICHOD",
      "PYQ",
      "Verified",
      "Unseen",
      "Authoring",
      "Ranker",
      "CBT",
      "Result",
      "Mistake Bank",
      "Mentor",
      "Adaptive Next Test",
      "Retry",
      "Mastery"
    ],

    files,

    syntax: {
      checked:
        js.length,
      failures:
        syntaxFailures
    },

    references: refs,

    html,

    subjects,

    git:
      gitState(),

    failures: {
      missingFiles,
      missingReferences,
      syntaxFailures
    },

    status:
      (
        missingFiles.length === 0 &&
        missingReferences.length === 0 &&
        syntaxFailures.length === 0
      )
        ? "PASS"
        : "ATTENTION"

  };
}

const report =
  buildReport();

fs.mkdirSync(
  path.dirname(REPORT),
  {
    recursive: true
  }
);

fs.writeFileSync(
  REPORT,
  JSON.stringify(
    report,
    null,
    2
  )
);

console.log("");
console.log(
  "=========================================="
);
console.log(
  " PCB NICHOD RUNTIME INTEGRATION TEST"
);
console.log(
  "=========================================="
);

console.log(
  "STATUS:",
  report.status
);

console.log(
  "FILES MISSING:",
  report.failures.missingFiles.length
);

console.log(
  "BROKEN REFERENCES:",
  report.failures.missingReferences.length
);

console.log(
  "JS SYNTAX FAILURES:",
  report.failures.syntaxFailures.length
);

console.log(
  "REPORT:",
  "nichod/data/runtime-health-report.json"
);

console.log(
  "=========================================="
);

if (
  report.failures.missingFiles.length
) {

  console.log(
    "\nMissing files:"
  );

  report.failures.missingFiles
    .forEach(
      x =>
        console.log(
          " -",
          x
        )
    );
}

if (
  report.failures.missingReferences.length
) {

  console.log(
    "\nBroken local references:"
  );

  report.failures.missingReferences
    .forEach(
      x =>
        console.log(
          " -",
          x.page,
          "->",
          x.file
        )
    );
}

if (
  report.failures.syntaxFailures.length
) {

  console.log(
    "\nSyntax failures:"
  );

  report.failures.syntaxFailures
    .forEach(
      x =>
        console.log(
          " -",
          x.file
        )
    );

}

console.log("");
