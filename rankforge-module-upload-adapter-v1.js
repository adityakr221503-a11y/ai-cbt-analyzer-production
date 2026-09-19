(function(root){
  "use strict";

  const VERSION = "RANKFORGE_MODULE_UPLOAD_ADAPTER_V1";

  const CONTRACT = () =>
    root.RankForgeModuleIngestionContractV1 || null;

  const ORCHESTRATOR = () =>
    root.RankForgeModuleIngestionOrchestratorV1 || null;

  const FABRIC = () =>
    root.RankForgeUniversalSourceFabric || null;

  const PDF = () =>
    root.RankForgeOwnerPDFExtractionEngineV6 || null;

  const ENGINE = () =>
    root.RankForgeSourceEngine || null;

  function extension(name){
    const m = String(name || "")
      .toLowerCase()
      .match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function detect(file){
    const ext = extension(file && file.name);

    const map = {
      pdf: "owner-pdf-v6",
      json: "owner-json",
      jsonl: "owner-jsonl",
      ndjson: "owner-ndjson",
      xml: "qti"
    };

    return {
      extension: ext,
      sourceType: map[ext] || null,
      supported: !!map[ext]
    };
  }

  function ownerPolicy(meta){
    const m = meta || {};

    /*
     * Owner-uploaded material:
     * provenance comes from the owner assertion.
     * Third-party/licensed material still requires
     * explicit license verification.
     */
    const owner = m.owner === true;

    return {
      owner,
      provenance: owner || !!m.provenance,
      licenseVerified:
        owner ? true : m.licenseVerified === true,
      requireLicenseVerification: !owner
    };
  }

  function createJob(file, meta){
    const C = CONTRACT();
    const O = ORCHESTRATOR();

    if(!C || !O)
      throw new Error("INGESTION_BACKBONE_UNAVAILABLE");

    const policy = ownerPolicy(meta);

    return C.createUploadContract({
      fileName: file && file.name,
      sizeBytes: file && file.size,
      sourceType: detect(file).sourceType,
      owner: policy.owner,
      provenance: policy.provenance,
      licenseVerified: policy.licenseVerified,
      requireLicenseVerification:
        policy.requireLicenseVerification
    });
  }

  async function ingest(file, meta, callbacks){
    if(!file)
      throw new Error("MODULE_FILE_REQUIRED");

    const d = detect(file);

    if(!d.supported)
      throw new Error("UNSUPPORTED_MODULE_FORMAT:" + d.extension);

    const C = CONTRACT();
    const O = ORCHESTRATOR();
    const F = FABRIC();

    if(!C || !O || !F)
      throw new Error("INGESTION_BACKBONE_UNAVAILABLE");

    const policy = ownerPolicy(meta);
    const job = createJob(file, meta);

    const notify = (event, data) => {
      try{
        if(callbacks && typeof callbacks[event] === "function")
          callbacks[event](data);
      }catch(_){}
    };

    notify("received", job);

    C.transition(job, C.STATUS.DETECTED, {
      detectedSourceType: d.sourceType
    });

    notify("detected", job);

    /*
     * PDF always uses the dedicated V6 extraction engine.
     * It remains separate from the student PDF->CBT flow.
     */
    if(d.extension === "pdf"){
      const P = PDF();

      if(!P || typeof P.importPDF !== "function")
        throw new Error("PDF_V6_ENGINE_UNAVAILABLE");

      const result = await P.importPDF(
        file,
        {
          ...(meta || {}),
          owner: policy.owner,
          provenance: policy.provenance,
          licenseVerified: policy.licenseVerified,
          sourceType: "owner-pdf-v6",
          ingestionJobId: job.jobId,
          ingestionContract: VERSION
        },
        {
          progress(data){
            notify("progress", {
              job,
              data
            });
          }
        }
      );

      C.transition(job, C.STATUS.PARSED, {
        parser: "owner-pdf-v6"
      });

      C.transition(job, C.STATUS.NORMALIZED);

      C.transition(job, C.STATUS.VALIDATED, {
        result
      });

      C.transition(job, C.STATUS.DUPLICATE_CHECKED);

      C.transition(job, C.STATUS.QUALITY_CHECKED);

      C.transition(job, C.STATUS.REVIEW);

      /*
       * V6 + Source Engine remain responsible for actual
       * question-level persistence/review decisions.
       * This adapter never creates another question DB.
       */
      notify("complete", {
        job,
        result,
        canonicalPipeline: true
      });

      return {
        ok: true,
        job,
        result,
        sourceType: d.sourceType,
        canonicalPipeline: true,
        parallelQuestionDatabase: false,
        answerGuessing: false
      };
    }

    /*
     * JSON / JSONL / NDJSON / QTI:
     * route through the Universal Source Fabric.
     */
    if(
      !F ||
      typeof F.ingest !== "function"
    ){
      throw new Error("UNIVERSAL_SOURCE_FABRIC_UNAVAILABLE");
    }

    const raw = await file.text();

    C.transition(job, C.STATUS.PARSED);

    const result = await F.ingest(raw, {
      ...(meta || {}),
      owner: policy.owner,
      provenance: policy.provenance,
      licenseVerified: policy.licenseVerified,
      sourceType: d.sourceType,
      sourceId: job.sourceId,
      ingestionJobId: job.jobId
    });

    C.transition(job, C.STATUS.NORMALIZED);

    C.transition(job, C.STATUS.VALIDATED, {
      acceptedCount: Number(result.accepted || 0),
      rejectedCount: Number(result.rejected || 0)
    });

    C.transition(job, C.STATUS.DUPLICATE_CHECKED);

    C.transition(job, C.STATUS.QUALITY_CHECKED);

    C.transition(job, C.STATUS.REVIEW);

    notify("complete", {
      job,
      result,
      canonicalPipeline: true
    });

    return {
      ok: true,
      job,
      result,
      sourceType: d.sourceType,
      canonicalPipeline: true,
      parallelQuestionDatabase: false,
      answerGuessing: false
    };
  }

  function health(){
    return {
      version: VERSION,
      contract: !!CONTRACT(),
      orchestrator: !!ORCHESTRATOR(),
      universalFabric: !!FABRIC(),
      pdfV6: !!PDF(),
      sourceEngine: !!ENGINE(),
      canonicalPipeline: true,
      parallelQuestionDatabase: false,
      answerGuessing: false,
      realUpload: false
    };
  }

  root.RankForgeModuleUploadAdapterV1 = {
    version: VERSION,
    detect,
    ownerPolicy,
    createJob,
    ingest,
    health
  };

})(typeof window !== "undefined" ? window : globalThis);
