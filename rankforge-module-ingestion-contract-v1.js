/*
 * RankForge Universal Module Ingestion Contract V1
 *
 * Upload contract:
 *   upload -> detect -> parse -> normalize -> validate
 *   -> provenance -> duplicate -> quality
 *   -> quarantine/review -> approve -> canonical pool
 *
 * IMPORTANT:
 * This layer does NOT upload or import any real question source.
 * It defines the reusable background contract only.
 */

(function(global){

  const VERSION = "RANKFORGE_MODULE_INGESTION_CONTRACT_V1";

  const STATUS = Object.freeze({
    RECEIVED: "RECEIVED",
    DETECTED: "DETECTED",
    PARSED: "PARSED",
    NORMALIZED: "NORMALIZED",
    VALIDATED: "VALIDATED",
    DUPLICATE_CHECKED: "DUPLICATE_CHECKED",
    QUALITY_CHECKED: "QUALITY_CHECKED",
    REVIEW: "REVIEW",
    QUARANTINE: "QUARANTINE",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    FAILED: "FAILED"
  });

  const SUPPORTED = Object.freeze([
    "pdf",
    "json",
    "jsonl",
    "ndjson",
    "qti",
    "authorized-api"
  ]);

  function id(prefix="RFJOB"){
    return prefix + "-" +
      Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2,10);
  }

  function createUploadContract(input={}) {
    if(!input || typeof input !== "object")
      throw new Error("INVALID_UPLOAD_CONTRACT");

    if(!input.fileName && !input.sourceType)
      throw new Error("SOURCE_IDENTITY_REQUIRED");

    return {
      contractVersion: VERSION,
      jobId: id(),
      sourceId: input.sourceId || id("SOURCE"),
      fileName: input.fileName || null,
      sourceType: input.sourceType || null,
      sizeBytes: Number(input.sizeBytes || 0),
      submittedAt: new Date().toISOString(),

      provenance: {
        owner: !!input.owner,
        licenseVerified: input.licenseVerified === true,
        sourceName: input.sourceName || null,
        sourceReference: input.sourceReference || null
      },

      policy: {
        allowAnswerGuessing: false,
        requireProvenance: true,
        requireLicenseVerification:
          input.requireLicenseVerification !== false,
        productionWrite: false
      },

      status: STATUS.RECEIVED,
      progress: 0,
      checkpoint: null,
      error: null
    };
  }

  function transition(job,status,extra={}) {
    if(!job || !Object.values(STATUS).includes(status))
      throw new Error("INVALID_STATUS");

    job.status = status;
    Object.assign(job,extra);

    return job;
  }

  function checkpoint(job,data={}) {
    job.checkpoint = {
      updatedAt: new Date().toISOString(),
      ...data
    };
    return job;
  }

  function canEnterCanonicalPool(job){
    return !!(
      job &&
      job.status === STATUS.APPROVED &&
      job.policy &&
      job.policy.allowAnswerGuessing === false &&
      job.policy.requireProvenance &&
      job.provenance &&
      job.provenance.licenseVerified === true
    );
  }

  function createLifecycle(){
    return [
      STATUS.RECEIVED,
      STATUS.DETECTED,
      STATUS.PARSED,
      STATUS.NORMALIZED,
      STATUS.VALIDATED,
      STATUS.DUPLICATE_CHECKED,
      STATUS.QUALITY_CHECKED,
      STATUS.REVIEW,
      STATUS.APPROVED
    ];
  }

  const API = {
    version: VERSION,
    STATUS,
    SUPPORTED,
    createUploadContract,
    transition,
    checkpoint,
    canEnterCanonicalPool,
    createLifecycle,

    health(){
      return {
        version: VERSION,
        contract: true,
        resumable: true,
        provenanceRequired: true,
        licenseGate: true,
        answerGuessing: false,
        productionWrite: false,
        canonicalPoolRequired: true
      };
    }
  };

  global.RankForgeModuleIngestionContractV1 = API;

})(typeof window !== "undefined" ? window : globalThis);
