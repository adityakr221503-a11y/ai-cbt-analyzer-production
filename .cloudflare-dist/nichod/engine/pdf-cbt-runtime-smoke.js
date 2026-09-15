"use strict";

const fs = require("fs");
const path = require("path");

const files = [
  "pdf-to-cbt.v317.html",
  "cbt.html",
  "nichod/engine/pdf-cbt-runtime-guard.js",
  "nichod/engine/pdf-cbt-auto-recovery.js",
  "nichod/engine/pdf-nichod-bridge.js",
  "nichod/engine/nichod-unified-orchestrator.js"
];

const checks = [];

for (const file of files) {
  const exists = fs.existsSync(file);

  checks.push({
    file,
    exists,
    size: exists ? fs.statSync(file).size : 0
  });
}

const htmlChecks = {
  pdfPageRecovery:
    fs.readFileSync("pdf-to-cbt.v317.html", "utf8")
      .includes("pdf-cbt-auto-recovery.js"),

  pdfPageGuard:
    fs.readFileSync("pdf-to-cbt.v317.html", "utf8")
      .includes("pdf-cbt-runtime-guard.js"),

  pdfNichod:
    fs.readFileSync("pdf-to-cbt.v317.html", "utf8")
      .includes("pdf-nichod-bridge.js"),

  cbtRecovery:
    fs.readFileSync("cbt.html", "utf8")
      .includes("pdf-cbt-auto-recovery.js"),

  cbtGuard:
    fs.readFileSync("cbt.html", "utf8")
      .includes("pdf-cbt-runtime-guard.js"),

  unified:
    fs.readFileSync("cbt.html", "utf8")
      .includes("nichod-unified-orchestrator.js")
};

const missing =
  checks.filter(x => !x.exists);

const failed =
  Object.entries(htmlChecks)
    .filter(([, value]) => !value);

const report = {
  timestamp: new Date().toISOString(),
  status:
    missing.length === 0 &&
    failed.length === 0
      ? "PASS"
      : "FAIL",

  filesChecked: checks.length,

  missingFiles: missing,

  failedReferences: failed.map(
    ([name]) => name
  ),

  checks: htmlChecks,

  nextRequiredTest:
    "Upload a real PDF in the browser and verify recovered question count."
};

fs.mkdirSync(
  path.dirname(
    "nichod/data/pdf-cbt-runtime-report.json"
  ),
  { recursive: true }
);

fs.writeFileSync(
  "nichod/data/pdf-cbt-runtime-report.json",
  JSON.stringify(report, null, 2)
);

console.log(
  "=========================================="
);

console.log(
  " PCB PDF → CBT RUNTIME SMOKE TEST"
);

console.log(
  "=========================================="
);

console.log(
  "STATUS:",
  report.status
);

console.log(
  "FILES CHECKED:",
  report.filesChecked
);

console.log(
  "MISSING FILES:",
  missing.length
);

console.log(
  "FAILED REFERENCES:",
  failed.length
);

console.log(
  "REPORT:",
  "nichod/data/pdf-cbt-runtime-report.json"
);

console.log(
  "=========================================="
);

if (report.status !== "PASS")
  process.exit(1);
