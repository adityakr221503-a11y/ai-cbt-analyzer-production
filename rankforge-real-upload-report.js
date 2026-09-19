"use strict";

const fs = require("fs");
const path = require("path");

const REPORT = "rankforge-real-ingestion-report.json";

function findAdapter() {
  try {
    if (typeof window !== "undefined" &&
        window.RankForgeModuleUploadAdapterV1) {
      return window.RankForgeModuleUploadAdapterV1;
    }
  } catch (_) {}
  return null;
}

const report = {
  version: "RANKFORGE_REAL_OWNER_INGESTION_REPORT_V1",
  generatedAt: new Date().toISOString(),
  execution: "READY_FOR_USER_SELECTED_PDF",
  realUpload: false,
  downloadsScan: false,
  answerGuessing: false,
  parallelQuestionDatabase: false,
  canonicalPipeline: true,
  adapter: false,
  pdfV6: false,
  sourceEngine: false,
  contract: false,
  orchestrator: false,
  universalFabric: false,
  counts: {
    parsed: 0,
    valid: 0,
    duplicate: 0,
    review: 0,
    quarantine: 0,
    approved: 0,
    canonical: 0
  }
};

const checks = {
  adapterFile: fs.existsSync("rankforge-module-upload-adapter-v1.js"),
  pdfV6File: fs.existsSync("rankforge-owner-pdf-engine-v6.js"),
  sourceEngineFile: fs.existsSync("rankforge-source-engine.js"),
  contractFile: fs.existsSync("rankforge-module-ingestion-contract-v1.js"),
  orchestratorFile: fs.existsSync("rankforge-module-ingestion-orchestrator-v1.js"),
  fabricFile: fs.existsSync("rankforge-universal-source-fabric-v1.js")
};

report.adapter = checks.adapterFile;
report.pdfV6 = checks.pdfV6File;
report.sourceEngine = checks.sourceEngineFile;
report.contract = checks.contractFile;
report.orchestrator = checks.orchestratorFile;
report.universalFabric = checks.fabricFile;

report.files = checks;
report.result = Object.values(checks).every(Boolean) ? "READY" : "FAIL";

fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));

if (report.result !== "READY") process.exit(1);
