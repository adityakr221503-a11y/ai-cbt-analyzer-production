(function(global){
"use strict";

function read(key,fallback){
  try{
    const x=JSON.parse(localStorage.getItem(key)||"null");
    return x==null ? fallback : x;
  }catch(_){
    return fallback;
  }
}

function audit(){
  const active=read("CBT_ACTIVE_TEST",null);
  const history=read("cbtHistory",[]);
  const mistakes=read("rankBoosterAttemptHistory",[]);
  const retry=read("cbtRetryQuestion",null);

  const aiActive=!!(
    active &&
    active.sourceType==="AI_GENERATED"
  );

  return {
    version:"RankForge AI CBT Single Flow V1",
    timestamp:new Date().toISOString(),

    flow:{
      aiBank:true,
      cbtScoring:true,
      existingResultPipeline:true,
      existingMistakePipeline:true,
      canonicalRetryKey:"cbtRetryQuestion"
    },

    activeAI:{
      active:aiActive,
      testId:active?.id || active?.testId || "",
      questionCount:Array.isArray(active?.questions)
        ? active.questions.length
        : 0
    },

    storage:{
      historyCount:Array.isArray(history) ? history.length : 0,
      mistakeCount:Array.isArray(mistakes) ? mistakes.length : 0,
      retryPresent:!!retry
    },

    protected:{
      topperTest180:true,
      pdfModule:true,
      dppParserAutoImport:false
    },

    duplicateWriterPolicy:{
      aiWritesCanonicalHistory:false,
      aiWritesCanonicalMistakes:false,
      aiWritesCanonicalMastery:false,
      aiOwnsScoring:false,
      existingCBTOwnsResult:true,
      existingMistakeEngineOwnsRetry:true
    }
  };
}

global.RankForgeAICBTSingleFlowAuditV1={audit};
})(window);
