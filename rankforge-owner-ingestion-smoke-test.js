
"use strict";
const checks = {};
const need = [
  ["SourceEngine", "rankforge-source-engine.js"],
  ["UniversalFabric", "rankforge-universal-source-fabric-v1.js"],
  ["IngestionContract", "rankforge-module-ingestion-contract-v1.js"],
  ["Orchestrator", "rankforge-module-ingestion-orchestrator-v1.js"],
  ["UploadAdapter", "rankforge-module-upload-adapter-v1.js"],
  ["OwnerPDFV6", "rankforge-owner-pdf-engine-v6.js"]
];
for (const [name,file] of need) checks[name] = require("fs").existsSync(file);
const files = require("fs").readFileSync;
checks.importPDF = files("rankforge-owner-pdf-engine-v6.js","utf8").includes("importPDF");
checks.canonicalSubmit = files("rankforge-owner-pdf-engine-v6.js","utf8").includes("submitModuleQuestions");
checks.noAnswerGuessing = !files("rankforge-module-upload-adapter-v1.js","utf8").match(/guessAnswer|autoGuessAnswer/i);
checks.noParallelDB = !files("rankforge-module-upload-adapter-v1.js","utf8").match(/indexedDB\.open|new\s+IndexedDB/i);
checks.reviewPath = files("rankforge-module-ingestion-contract-v1.js","utf8").includes("REVIEW");
checks.quarantinePath = files("rankforge-module-ingestion-contract-v1.js","utf8").includes("QUARANTINE");
checks.approvedPath = files("rankforge-module-ingestion-contract-v1.js","utf8").includes("APPROVED");
const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({checks, result: pass ? "PASS" : "FAIL"}, null, 2));
if (!pass) process.exit(1);
