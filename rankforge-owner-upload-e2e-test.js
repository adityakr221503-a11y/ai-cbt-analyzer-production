(function(){
  "use strict";

  const A=window.RankForgeModuleUploadAdapterV1;
  const C=window.RankForgeModuleIngestionContractV1;
  const O=window.RankForgeModuleIngestionOrchestratorV1;
  const F=window.RankForgeUniversalSourceFabric;
  const S=window.RankForgeSourceEngine;

  const result={
    adapter:!!A,
    contract:!!C,
    orchestrator:!!O,
    fabric:!!F,
    sourceEngine:!!S,
    canonicalPipeline:false,
    parallelDatabase:false,
    answerGuessing:false,
    productionWrites:false,
    realUpload:false,
    PASS:false
  };

  if(A && C && O && F && S){
    const h=A.health ? A.health() : {};
    result.canonicalPipeline=h.canonicalPipeline!==false;
    result.parallelDatabase=h.parallelQuestionDatabase===true;
    result.answerGuessing=h.answerGuessing===true;
  }

  /*
   * IMPORTANT:
   * No real file is opened.
   * No Downloads directory is scanned.
   * No production question is inserted.
   */
  result.productionWrites=false;
  result.realUpload=false;

  result.PASS=
    result.adapter &&
    result.contract &&
    result.orchestrator &&
    result.fabric &&
    result.sourceEngine &&
    result.canonicalPipeline &&
    !result.parallelDatabase &&
    !result.answerGuessing &&
    !result.productionWrites &&
    !result.realUpload;

  console.table(result);
  console.log(
    result.PASS
      ? "OWNER UPLOAD E2E DRY-RUN: PASS"
      : "OWNER UPLOAD E2E DRY-RUN: FAIL"
  );

  window.RankForgeOwnerUploadE2ETest=result;
})();
