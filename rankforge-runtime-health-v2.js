(function(global){
"use strict";

const VERSION="RankForge Runtime Health V2";

function read(key){
  try { return JSON.parse(localStorage.getItem(key)||"null"); }
  catch(e){ return null; }
}

function count(v){
  if(Array.isArray(v)) return v.length;
  if(v && Array.isArray(v.questions)) return v.questions.length;
  if(v && Array.isArray(v.items)) return v.items.length;
  return 0;
}

function test(){
  const active=read("CBT_ACTIVE_TEST");
  const history=read("cbtHistory");
  const masterMeta=read("rankForgeMasterQuestionPoolV2Meta");

  const checks={
    masterPoolMeta:!!masterMeta,
    masterPoolCount:count(masterMeta),
    activeTest:!!active,
    activeQuestionCount:count(active),
    activeEngineV2:!!read("rankforgeActiveEngineTestV2"),
    questionEngineV2:!!global.RankForgeQuestionEngineV2,
    cbtBridgeV2:!!global.RankForgeQuestionEngineCBTBridgeV2,
    metadataBridgeV2:!!global.RankForgeResultMetadataBridgeV2,
    historyCount:Array.isArray(history)?history.length:0,
    topperTest180Protected:!!read("TOPPER_TEST_180"),
    dppParserAutoImport:false
  };

  checks.pipelineReady =
    checks.activeTest &&
    checks.activeQuestionCount>0 &&
    checks.questionEngineV2 &&
    checks.cbtBridgeV2 &&
    checks.metadataBridgeV2;

  return {
    version:VERSION,
    timestamp:new Date().toISOString(),
    checks
  };
}

function render(){
  let box=document.getElementById("rankforge-runtime-health-v2");
  if(!box){
    box=document.createElement("pre");
    box.id="rankforge-runtime-health-v2";
    box.style.cssText=
      "position:fixed;left:10px;right:10px;bottom:10px;z-index:999999;" +
      "max-height:45vh;overflow:auto;padding:12px;border-radius:10px;" +
      "background:#111;color:#fff;font:12px monospace;white-space:pre-wrap;";
    document.body.appendChild(box);
  }

  const report=test();
  box.textContent=
    "RANKFORGE RUNTIME HEALTH V2\n\n"+
    JSON.stringify(report,null,2);
}

global.RankForgeRuntimeHealthV2={
  version:VERSION,
  test:test,
  render:render
};

setTimeout(render,1200);

})(window);
