(function(global){
"use strict";

const VERSION="RankForge Runtime Health V2";
const MASTER_META_KEY="rankForgeMasterQuestionPoolV2Meta";

function read(key){
  try{
    return JSON.parse(localStorage.getItem(key)||"null");
  }catch(e){
    return null;
  }
}

function count(v){
  if(Array.isArray(v)) return v.length;
  if(v && Array.isArray(v.questions)) return v.questions.length;
  if(v && Array.isArray(v.items)) return v.items.length;
  return 0;
}

async function ensurePipeline(){
  const master=global.RankForgeMasterPoolV2;

  if(master && typeof master.build==="function"){
    try{
      const existing=await master.getAll();

      if(!Array.isArray(existing) || !existing.length){
        await master.build({
          minQuality:35,
          allowLowQuality:false
        });
      }
    }catch(e){
      console.warn("RankForge Master Pool bootstrap:",e);
    }
  }

  /*
   * rankers-test-series.html historically omitted the result
   * metadata bridge. Load it dynamically so the V2 pipeline
   * is complete without modifying TOPPER_TEST_180 or source banks.
   */
  if(
    !global.RankForgeResultMetadataBridgeV2 &&
    !document.querySelector(
      'script[data-rankforge-result-metadata-v2="1"]'
    )
  ){
    const script=document.createElement("script");

    script.src="./rankforge-result-metadata-bridge-v2.js";
    script.async=false;
    script.dataset.rankforgeResultMetadataV2="1";

    document.head.appendChild(script);
  }
}

function test(){
  const active=read("CBT_ACTIVE_TEST");
  const history=read("cbtHistory");
  const masterMeta=read(MASTER_META_KEY);

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

  checks.pipelineReady=
    checks.masterPoolCount>0 &&
    checks.questionEngineV2 &&
    checks.cbtBridgeV2 &&
    checks.metadataBridgeV2;

  return{
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
      "position:fixed;left:10px;right:10px;bottom:10px;z-index:999999;"+
      "max-height:45vh;overflow:auto;padding:12px;border-radius:10px;"+
      "background:#111;color:#fff;font:12px monospace;white-space:pre-wrap;";

    document.body.appendChild(box);
  }

  box.textContent=
    "RANKFORGE RUNTIME HEALTH V2\n\n"+
    JSON.stringify(test(),null,2);
}

global.RankForgeRuntimeHealthV2={
  version:VERSION,
  test,
  render,
  ensurePipeline
};

(async function(){
  await ensurePipeline();

  /*
   * Give dynamically loaded metadata bridge a moment to register.
   */
  setTimeout(render,1200);
  setTimeout(render,3000);
  setTimeout(render,6000);
})();

})(window);
