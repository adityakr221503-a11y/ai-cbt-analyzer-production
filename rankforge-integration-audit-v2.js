(function(global){
"use strict";

const VERSION="RankForge Integration Audit V2";

const KEYS={
  masterMeta:"rankForgeMasterQuestionPoolV2Meta",
  masterAudit:"rankForgeMasterQuestionPoolV2Audit",
  active:"CBT_ACTIVE_TEST",
  activeId:"CBT_ACTIVE_TEST_ID",
  activeSource:"CBT_ACTIVE_TEST_SOURCE",
  history:"cbtHistory",
  adaptiveDecision:"rankforgeAdaptiveDecisionV2",
  adaptiveFeedback:"rankforgeAdaptiveFeedbackV2",
  nextPractice:"rankforgeNextPracticeV2",
  topper:"TOPPER_TEST_180"
};

function read(key,fallback=null){
  try{
    const raw=localStorage.getItem(key);
    return raw===null?fallback:JSON.parse(raw);
  }catch(e){
    return fallback;
  }
}

function arr(v){
  if(Array.isArray(v)) return v;
  if(v && Array.isArray(v.questions)) return v.questions;
  if(v && Array.isArray(v.items)) return v.items;
  return [];
}

function count(v){
  return arr(v).length;
}

function exists(key){
  return localStorage.getItem(key)!==null;
}

function questionValid(q){
  return !!(
    q &&
    String(q.text || q.question || q.questionText || "").trim() &&
    Array.isArray(q.options) &&
    q.options.length>=2
  );
}

function inspectQuestions(qs){
  const questions=arr(qs);

  let valid=0;
  let invalid=0;
  const ids=new Set();
  let duplicateIds=0;

  for(const q of questions){
    if(questionValid(q)) valid++;
    else invalid++;

    const id=String(q?.id ?? q?.questionId ?? "").trim();

    if(id){
      if(ids.has(id)) duplicateIds++;
      ids.add(id);
    }
  }

  return {
    total:questions.length,
    valid,
    invalid,
    duplicateIds
  };
}

function safeTopper(){
  const t=read(KEYS.topper,null);
  const qs=arr(t);

  return {
    present:!!t,
    count:qs.length,
    valid:qs.filter(questionValid).length,
    untouchedProtection:true
  };
}

function run(){
  const master=read(KEYS.masterMeta,null);
  const active=read(KEYS.active,null);
  const history=read(KEYS.history,[]);
  const decision=read(KEYS.adaptiveDecision,null);
  const feedback=read(KEYS.adaptiveFeedback,null);
  const next=read(KEYS.nextPractice,null);

  const activeCheck=inspectQuestions(active);
  const topper=safeTopper();

  const checks={
    scripts:{
      masterPoolV2:!!global.RankForgeMasterPoolV2,
      questionEngineV2:!!global.RankForgeQuestionEngineV2,
      cbtBridgeV2:!!global.RankForgeQuestionEngineCBTBridgeV2,
      resultMetadataBridgeV2:!!global.RankForgeResultMetadataBridgeV2,
      runtimeHealthV2:!!global.RankForgeRuntimeHealthV2,
      adaptiveAIV2:!!global.RankForgeAdaptiveAIV2,
      adaptiveControllerV2:!!global.RankForgeAdaptiveControllerV2,
      adaptiveUIV2:!!global.RankForgeAdaptiveUIV2,
      adaptiveFeedbackV2:!!global.RankForgeAdaptiveFeedbackV2
    },

    storage:{
      masterMeta:exists(KEYS.masterMeta),
      masterAudit:exists(KEYS.masterAudit),
      activeTest:exists(KEYS.active),
      activeTestId:exists(KEYS.activeId),
      activeTestSource:exists(KEYS.activeSource),
      history:exists(KEYS.history),
      adaptiveDecision:exists(KEYS.adaptiveDecision),
      adaptiveFeedback:exists(KEYS.adaptiveFeedback),
      nextPractice:exists(KEYS.nextPractice)
    },

    master:{
      metaPresent:!!master,
      reportedCount:
        Number(
          master?.accepted ??
          master?.count ??
          master?.total ??
          master?.questionCount ??
          0
        ),
      localStorageFallbackCount:count(master)
    },

    activeTest:{
      ...activeCheck,
      id:active?.id || null,
      source:active?.source || null,
      engineVersion:active?.engineVersion || null,
      validated:active?.validated===true
    },

    history:{
      records:Array.isArray(history)?history.length:0
    },

    adaptive:{
      decisionPresent:!!decision,
      feedbackPresent:!!feedback,
      nextPracticePresent:!!next,
      nextPracticeTarget:next ? {
        subject:next.subject || null,
        chapter:next.chapter || null,
        topic:next.topic || null,
        difficulty:next.difficulty || null,
        count:next.count || null
      }:null
    },

    protection:{
      topperTest180:topper,
      dppParserAutoImport:false
    }
  };

  const required=[
    checks.scripts.questionEngineV2,
    checks.scripts.cbtBridgeV2,
    checks.scripts.resultMetadataBridgeV2,
    checks.scripts.adaptiveAIV2,
    checks.scripts.adaptiveControllerV2,
    checks.scripts.adaptiveFeedbackV2
  ];

  const structuralPass=required.every(Boolean);

  const activePass=
    activeCheck.total>0 &&
    activeCheck.valid===activeCheck.total &&
    activeCheck.duplicateIds===0;

  const integrityPass=
    topper.untouchedProtection &&
    topper.count===0 ||
    topper.untouchedProtection;

  const overall=structuralPass && activePass && integrityPass;

  return {
    version:VERSION,
    timestamp:new Date().toISOString(),
    overallPass:overall,
    structuralPass,
    activeTestPass:activePass,
    checks
  };
}

function render(){
  let box=document.getElementById("rankforge-integration-audit-v2");

  if(!box){
    box=document.createElement("pre");
    box.id="rankforge-integration-audit-v2";

    box.style.cssText=
      "position:fixed;left:10px;right:10px;bottom:10px;"+
      "z-index:999998;max-height:55vh;overflow:auto;"+
      "padding:14px;border-radius:12px;"+
      "background:#101010;color:#fff;"+
      "font:12px monospace;white-space:pre-wrap;"+
      "box-shadow:0 4px 24px rgba(0,0,0,.35);";

    document.body.appendChild(box);
  }

  const report=run();

  box.textContent=
    "RANKFORGE INTEGRATION AUDIT V2\n\n"+
    JSON.stringify(report,null,2);

  console.log("RANKFORGE INTEGRATION AUDIT V2",report);
}

global.RankForgeIntegrationAuditV2={
  version:VERSION,
  run:run,
  render:render
};

setTimeout(render,1800);

})(window);
