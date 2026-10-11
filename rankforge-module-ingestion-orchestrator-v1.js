(function (root) {
  "use strict";

  const VERSION = "RANKFORGE_MODULE_INGESTION_ORCHESTRATOR_V1";
  const CONTRACT = "RANKFORGE_MODULE_INGESTION_CONTRACT_V1";

  const STATES = [
    "RECEIVED","DETECTED","PARSED","NORMALIZED","VALIDATED",
    "DUPLICATE_CHECKED","QUALITY_CHECKED","REVIEW",
    "QUARANTINE","APPROVED","REJECTED","FAILED"
  ];

  const SOURCE_MAP = {
    pdf: "owner-pdf-v6",
    json: "owner-json",
    jsonl: "owner-jsonl",
    ndjson: "owner-ndjson",
    qti: "qti"
  };

  function id(prefix) {
    return prefix + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 10);
  }

  function ext(name) {
    const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function detect(fileName) {
    const e = ext(fileName);
    return SOURCE_MAP[e] ? {
      extension: e,
      sourceType: SOURCE_MAP[e],
      supported: true
    } : {
      extension: e,
      sourceType: null,
      supported: false
    };
  }

  function createJob(fileName, meta) {
    const d = detect(fileName);
    return {
      id: id("RFJOB-"),
      version: VERSION,
      contract: CONTRACT,
      fileName: String(fileName || ""),
      sourceType: d.sourceType,
      extension: d.extension,
      state: "RECEIVED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      productionWrite: false,
      realUpload: false,
      questionCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      checkpoint: 0,
      provenance: !!(meta && meta.provenance),
      licenseVerified: !!(meta && meta.licenseVerified),
      answerGuessing: false,
      history: [{
        state: "RECEIVED",
        at: new Date().toISOString()
      }]
    };
  }

  function transition(job, state, data) {
    if (!job || !STATES.includes(state)) {
      throw new Error("Invalid ingestion state");
    }
    job.state = state;
    job.updatedAt = new Date().toISOString();
    if (data && typeof data === "object") Object.assign(job, data);
    job.history.push({
      state,
      at: job.updatedAt
    });
    return job;
  }

  function checkpoint(job, pageOrBatch) {
    job.checkpoint = Number(pageOrBatch) || 0;
    job.updatedAt = new Date().toISOString();
    return {
      jobId: job.id,
      checkpoint: job.checkpoint,
      resumable: true,
      productionWrite: false
    };
  }

  function engineAvailable() {
    return !!(
      root.RankForgeSourceEngine &&
      root.RankForgeOwnerPDFExtractionEngineV6
    );
  }

  function canonicalGate(job) {
    return !!(
      job.state === "APPROVED" &&
      job.provenance &&
      job.licenseVerified &&
      job.answerGuessing === false
    );
  }

  function plan(job) {
    const steps = [
      "RECEIVED",
      "DETECTED",
      "PARSED",
      "NORMALIZED",
      "VALIDATED",
      "DUPLICATE_CHECKED",
      "QUALITY_CHECKED",
      "REVIEW"
    ];

    if (!job.provenance) {
      return {
        jobId: job.id,
        status: "QUARANTINE",
        reason: "PROVENANCE_REQUIRED",
        steps
      };
    }

    if (!job.licenseVerified) {
      return {
        jobId: job.id,
        status: "QUARANTINE",
        reason: "LICENSE_VERIFICATION_REQUIRED",
        steps
      };
    }

    return {
      jobId: job.id,
      status: "READY_FOR_APPROVAL",
      steps
    };
  }

  function simulate(fileName, meta) {
    const job = createJob(fileName, meta || {});

    transition(job, "DETECTED");

    if (!job.sourceType) {
      transition(job, "FAILED", {
        error: "UNSUPPORTED_FORMAT"
      });
      return job;
    }

    transition(job, "PARSED");
    transition(job, "NORMALIZED");
    transition(job, "VALIDATED", {
      questionCount: 0
    });
    transition(job, "DUPLICATE_CHECKED", {
      duplicateCount: 0
    });
    transition(job, "QUALITY_CHECKED", {
      acceptedCount: 0,
      rejectedCount: 0
    });
    transition(job, "REVIEW");

    if (job.provenance && job.licenseVerified) {
      transition(job, "APPROVED");
    } else {
      transition(job, "QUARANTINE", {
        error: "SOURCE_POLICY_GATE"
      });
    }

    checkpoint(job, 0);
    return job;
  }

  function health() {
    return {
      version: VERSION,
      contract: CONTRACT,
      states: STATES.length,
      supportedFormats: Object.keys(SOURCE_MAP),
      sourceEngine: !!root.RankForgeSourceEngine,
      pdfV6: !!root.RankForgeOwnerPDFExtractionEngineV6,
      canonicalPipeline: true,
      parallelQuestionDatabase: false,
      answerGuessing: false,
      productionWrite: false,
      realUpload: false
    };
  }

  root.RankForgeModuleIngestionOrchestratorV1 = {
    version: VERSION,
    contract: CONTRACT,
    states: STATES.slice(),
    detect,
    createJob,
    transition,
    checkpoint,
    canonicalGate,
    plan,
    simulate,
    health
  };

})(typeof window !== "undefined" ? window : globalThis);
